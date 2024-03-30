// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IBinder} from "./interfaces/IBinder.sol";
import {IParentBinder} from "./interfaces/IParentBinder.sol";
import "./interfaces/IRequirementChecker.sol";
import "./interfaces/IRarityProvider.sol";

/**
 * @title Binder.sol
 * @dev Binder.sol contract
 * Every mention of "share" in this contract does NOT relate to company or revenue shares.
 * It is simply a fraction of a whole.
 */
contract Binder is Initializable, AccessControlUpgradeable, IBinder {
    /***************************
     * STRUCTS                 *
     ***************************/

    struct SlotDefinition {
        RequirementDefiniton[] requirements;
    }

    struct VersionData {
        uint256 id;
        IParentBinder parentBinder;
    }

    struct LockedNft {
        Nft nft;
        uint256 unstakeTime;
    }

    struct BinderNftView {
        uint256 id;
        uint256 shares;
        Nft[] slots;
        LockedNft[] lockedNfts;
    }

    struct BinderNft {
        LockedNft[] lockedNfts;
        mapping(uint256 => Nft) slots;
    }

    struct Nft {
        IERC721 tokenContract;
        uint256 tokenId;
    }

    struct NftInput {
        IERC721 tokenContract;
        uint256 tokenId;
        uint256 slotId;
    }

    /***************************
     * ERRORS                  *
     ***************************/

    error InvalidSlot(uint256 slotId);
    error NotTheOwner(address owner, address caller, uint256 tokenId);
    error IndexesNotSortedDescending();
    error NftStillLocked(
        uint256 lockedNftIndex,
        uint256 unlockTime,
        uint256 currentTime
    );

    /***************************
     * EVENTS                  *
     ***************************/

    event RequirementCheckerSet(address indexed requirementChecker);
    event UnstakeLockPeriodSet(uint256 unstakeLockPeriod);
    event VersionAdded(
        uint256 indexed version,
        uint256 indexed id,
        IParentBinder indexed parentBinder
    );
    event NftAdded(
        uint256 indexed binderNftId,
        uint256 indexed slotId,
        address tokenContract,
        uint256 tokenId
    );
    event NftRemoved(
        uint256 indexed binderNftId,
        uint256 indexed slotId,
        address tokenContract,
        uint256 tokenId
    );
    event UnlockedNftClaimed(
        uint256 indexed binderNftId,
        address indexed owner,
        uint256 indexed claimedTokenId
    );

    /***************************
     * CONSTANTS               *
     ***************************/

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant BINDER_NFT_ROLE = keccak256("BINDER_NFT_ROLE");
    uint256 public constant PRECISION = 1e12;

    /***************************
     * STORAGE                 *
     ***************************/

    /// @dev BinderNft contract
    IERC721 binderNft;

    /// @dev version => VersionData
    mapping(uint256 => VersionData) public versions;
    /// @dev list of all added version ids
    uint256[] public versionIds;

    /// @dev binderNftId => BinderNft data
    mapping(uint256 => BinderNft) binderNfts;

    /// @dev sum of all shares
    uint256 public totalUserShares;
    /// @dev user address => shares
    mapping(address => uint256) public userShares;
    /// @dev version => accumulated pmon amount
    mapping(uint256 => uint256) public accPmon;
    /// @dev version => accumulated pmon per share
    mapping(uint256 => uint256) public accPmonPerShare;
    /// @dev version => user address => rewardDebt
    mapping(uint256 => mapping(address => uint256)) public userRewardDebt;

    IRequirementChecker public requirementChecker;
    SlotDefinition[] slotDefinitions; // TODO add view

    /// @dev lock period for claiming nfts after unstaking in seconds
    uint256 public unstakeLockPeriod;

    /***************************
     * INITIALIZER             *
     ***************************/

    function initialize(
        address defaultAdmin,
        address _binderNft,
        IRequirementChecker _requirementChecker,
        SlotDefinition[] calldata _slotDefinitions,
        uint256 _unstakeLockPeriod
    ) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(GOVERNANCE_ROLE, defaultAdmin);
        _grantRole(BINDER_NFT_ROLE, _binderNft);

        binderNft = IERC721(_binderNft);

        requirementChecker = _requirementChecker;
        for (uint256 i = 0; i < _slotDefinitions.length; ) {
            slotDefinitions.push(_slotDefinitions[i]);

            unchecked {
                i++;
            }
        }

        unstakeLockPeriod = _unstakeLockPeriod;
    }

    /***************************
     * GOVERNANCE FUNCTIONS    *
     ***************************/

    /// @notice Add a new version
    /// Can only be called by the governance role
    /// @param version version number
    /// @param id id of the binder for the specified version known by the parent binder
    /// @param parentBinder parent binder contract
    function addVersion(
        uint256 version,
        uint256 id,
        IParentBinder parentBinder
    ) external onlyRole(GOVERNANCE_ROLE) {
        versions[version].id = id;
        versions[version].parentBinder = parentBinder;
        versionIds.push(version);

        emit VersionAdded(version, id, parentBinder);
    }

    /// @notice Set the requirement checker contract
    /// Can only be called by the governance role
    /// @param _requirementChecker requirement checker contract
    function setRequirementChecker(
        IRequirementChecker _requirementChecker
    ) external onlyRole(GOVERNANCE_ROLE) {
        requirementChecker = _requirementChecker;

        emit RequirementCheckerSet(address(_requirementChecker));
    }

    /// @notice Set the unstake lock period
    /// Can only be called by the governance role
    /// @param _unstakeLockPeriod unstake lock period in seconds
    function setUnstakeLockPeriod(
        uint256 _unstakeLockPeriod
    ) external onlyRole(GOVERNANCE_ROLE) {
        unstakeLockPeriod = _unstakeLockPeriod;

        emit UnstakeLockPeriodSet(_unstakeLockPeriod);
    }

    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    /// @notice stake nfts to a binder nft
    /// @param binderNftId id of the binder nft
    /// @param nfts list of nfts to stake
    /// @param replace if true, replace existing nfts in the slot. If false, revert if slot is not empty
    function stakeToBinderNft(
        uint256 binderNftId,
        NftInput[] calldata nfts,
        bool replace
    ) external {
        address owner = binderNft.ownerOf(binderNftId);
        if (owner != msg.sender) {
            revert NotTheOwner(owner, msg.sender, binderNftId);
        }

        // transfer nfts and update slots
        uint256 numOfNfts = nfts.length;
        uint256 shares = 0;
        uint256 removedShares = 0;
        for (uint256 i = 0; i < numOfNfts; ) {
            NftInput memory nft = nfts[i];

            if (
                nft.slotId >= slotDefinitions.length ||
                !requirementChecker.check(
                    address(nft.tokenContract),
                    nft.tokenId,
                    slotDefinitions[nft.slotId].requirements
                )
            ) {
                revert InvalidSlot(nft.slotId);
            }

            Nft memory slot = binderNfts[binderNftId].slots[nft.slotId];
            // check if slot is empty
            if (address(slot.tokenContract) != address(0)) {
                // only replace the non empty slot if replace is true - otherwise revert
                if (replace) {
                    // lock removed nft (can be removed after lock period with claimUnlockedNfts)
                    binderNfts[binderNftId].lockedNfts.push(
                        LockedNft({nft: slot, unstakeTime: block.timestamp})
                    );
                    removedShares += IRarityProvider(
                        address(slot.tokenContract)
                    ).rarity(slot.tokenId);

                    delete binderNfts[binderNftId].slots[nft.slotId];

                    emit NftRemoved(
                        binderNftId,
                        nft.slotId,
                        address(slot.tokenContract),
                        slot.tokenId
                    );
                } else {
                    revert InvalidSlot(nft.slotId);
                }
            }

            if (nft.tokenContract.ownerOf(nft.tokenId) != msg.sender) {
                revert NotTheOwner(
                    nft.tokenContract.ownerOf(nft.tokenId),
                    msg.sender,
                    nft.tokenId
                );
            }
            nft.tokenContract.transferFrom(
                msg.sender,
                address(this),
                nft.tokenId
            );
            shares += IRarityProvider(address(nft.tokenContract)).rarity(
                nft.tokenId
            );

            binderNfts[binderNftId].slots[nft.slotId] = Nft({
                tokenContract: nft.tokenContract,
                tokenId: nft.tokenId
            });

            emit NftAdded(
                binderNftId,
                nft.slotId,
                address(nft.tokenContract),
                nft.tokenId
            );
            unchecked {
                i++;
            }
        }

        updateRewards();

        _claimRewards(msg.sender);

        // update shares
        if (shares > removedShares) {
            shares = shares - removedShares;
            totalUserShares += shares;
            userShares[msg.sender] += shares;
        } else if (shares < removedShares) {
            shares = removedShares - shares;
            totalUserShares -= shares;
            userShares[msg.sender] -= shares;
        }

        _updateRewardDebt(msg.sender);
    }

    /// @notice unstake nfts from a binder nft.
    /// The nfts will be locked for a period of time to prevent running a
    /// unstake transaction before a sell transaction is executed to
    /// remove nfts from the binder the buyer paid for. The Nft can be
    /// claimed after the lock period with claimUnlockedNfts.
    /// @param binderNftId id of the binder nft
    /// @param nfts list of nfts to unstake
    function unstakeFromBinderNft(
        uint256 binderNftId,
        NftInput[] calldata nfts
    ) external {
        address owner = binderNft.ownerOf(binderNftId);
        if (owner != msg.sender) {
            revert NotTheOwner(owner, msg.sender, binderNftId);
        }

        // transfer nfts and update slots
        uint256 numOfNfts = nfts.length;
        uint256 shares = 0;
        for (uint256 i = 0; i < numOfNfts; ) {
            NftInput memory nft = nfts[i];

            Nft memory slot = binderNfts[binderNftId].slots[nft.slotId];
            if (
                slot.tokenContract != nft.tokenContract ||
                slot.tokenId != nft.tokenId
            ) {
                revert InvalidSlot(nft.slotId);
            }

            // lock removed nft (can be removed after lock period with claimUnlockedNfts)
            binderNfts[binderNftId].lockedNfts.push(
                LockedNft({nft: slot, unstakeTime: block.timestamp})
            );
            shares += IRarityProvider(address(nft.tokenContract)).rarity(
                nft.tokenId
            );

            delete binderNfts[binderNftId].slots[nft.slotId];

            emit NftRemoved(
                binderNftId,
                nft.slotId,
                address(nft.tokenContract),
                nft.tokenId
            );
            unchecked {
                i++;
            }
        }

        updateRewards();

        _claimRewards(msg.sender);

        // update shares
        totalUserShares -= shares;
        userShares[msg.sender] -= shares;

        _updateRewardDebt(msg.sender);
    }

    /// @notice Unstake removed nfts from a binder nft but lock them for a period
    /// of time to prevent running a unstake transaction before a sell transaction
    /// is executed to remove nfts from the binder the buyer paid for.
    /// After the lock period is over, the nfts can be claimed by the owner of the binder nft.
    /// @param binderNftId id of the binder nft
    /// @param nftIndexes list of indexes of nfts to claim.
    /// The indexes must be sorted in descending order. Or the transaction will revert.
    function claimUnlockedNfts(
        uint256 binderNftId,
        uint[] calldata nftIndexes
    ) external {
        if (msg.sender != binderNft.ownerOf(binderNftId)) {
            revert NotTheOwner(
                binderNft.ownerOf(binderNftId),
                msg.sender,
                binderNftId
            );
        }

        LockedNft[] storage lockedNfts = binderNfts[binderNftId].lockedNfts;
        for (uint256 i = 0; i < nftIndexes.length; ) {
            if (i > 0 && nftIndexes[i] >= nftIndexes[i - 1]) {
                revert IndexesNotSortedDescending();
            }
            LockedNft memory lockedNft = lockedNfts[nftIndexes[i]];
            if (lockedNft.unstakeTime + unstakeLockPeriod <= block.timestamp) {
                if (nftIndexes[i] < lockedNfts.length - 1) {
                    lockedNfts[nftIndexes[i]] = lockedNfts[
                        lockedNfts.length - 1
                    ];
                }
                lockedNfts.pop();
                lockedNft.nft.tokenContract.transferFrom(
                    address(this),
                    msg.sender,
                    lockedNft.nft.tokenId
                );
                emit UnlockedNftClaimed(
                    binderNftId,
                    msg.sender,
                    lockedNft.nft.tokenId
                );
            } else {
                revert NftStillLocked(
                    nftIndexes[i],
                    lockedNft.unstakeTime + unstakeLockPeriod,
                    block.timestamp
                );
            }
            unchecked {
                i++;
            }
        }
    }

    /// @notice Claim the rewards for the specified version
    /// @param user User to claim rewards for
    /// @param version Version to claim rewards for
    function claimReward(address user, uint256 version) external {
        if (userShares[user] == 0) {
            return;
        }

        updateReward(version);

        _claimReward(user, version);
    }

    /// @notice Update rewards (accPmonPerShare) for all versions
    function updateRewards() public {
        for (uint256 i = 0; i < versionIds.length; ) {
            updateReward(versionIds[i]);
            unchecked {
                i++;
            }
        }
    }

    /// @notice Update reward (accPmonPerShare) for the specified version
    /// @param version Version to update
    function updateReward(uint256 version) public {
        VersionData memory versionData = versions[version];
        uint256 newAccPmon = versionData.parentBinder.getAndUpdateAccPmon(
            version,
            versionData.id
        );
        uint256 prevAccPmon = accPmon[version];
        if (newAccPmon != prevAccPmon && totalUserShares > 0) {
            uint256 newReward = newAccPmon - prevAccPmon;
            accPmonPerShare[version] +=
                (newReward * PRECISION) /
                totalUserShares;
            accPmon[version] = newAccPmon;
        }
    }

    /// @dev requires owner check to be done by caller
    function prepareBinderNftTransfer(
        address from,
        address to,
        uint256 /** binderNftId */
    ) external onlyRole(BINDER_NFT_ROLE) {
        uint256 shares = userShares[from];

        if (shares > 0) {
            updateRewards();

            _claimRewards(from);
            userShares[from] -= shares;
            _updateRewardDebt(from);
            _claimRewards(to);
            userShares[to] += shares;
            _updateRewardDebt(to);
        }
    }

    /***************************
     * INTERNAL FUNCTIONS      *
     ***************************/

    /// @dev requires updateRewards() to be called before this function
    function _updateRewardDebt(address user) internal {
        for (uint256 i = 0; i < versionIds.length; ) {
            uint256 version = versionIds[i];
            userRewardDebt[version][user] =
                (userShares[user] * accPmonPerShare[version]) /
                PRECISION;
            unchecked {
                i++;
            }
        }
    }

    /// @dev requires updateRewards() to be called before this function
    function _claimRewards(address user) internal {
        for (uint256 i = 0; i < versionIds.length; ) {
            _claimReward(user, versionIds[i]);
            unchecked {
                i++;
            }
        }
    }

    /// @dev requires updateReward(version) to be called before this function
    function _claimReward(address user, uint256 version) internal {
        if (userShares[user] == 0) {
            return;
        }

        uint256 reward = (userShares[user] * accPmonPerShare[version]) /
            PRECISION -
            userRewardDebt[version][user];

        if (reward > 0) {
            userRewardDebt[version][user] =
                (userShares[user] * accPmonPerShare[version]) /
                PRECISION;
            VersionData memory versionData = versions[version];
            versionData.parentBinder.claimReward(
                version,
                versionData.id,
                user,
                reward
            );
        }
    }

    /***************************
     * VIEW FUNCTIONS          *
     ***************************/

    /// @notice Get the current reward amount for a user and version
    /// @param user the user address
    /// @param version the version
    /// @return the current reward amount
    function getCurrentRewardAmount(
        address user,
        uint256 version
    ) external view returns (uint256) {
        if (userShares[user] == 0) {
            return 0;
        }

        // update rewards
        VersionData memory versionData = versions[version];
        uint256 newAccPmon = versionData.parentBinder.getAccPmon(
            version,
            versionData.id
        );
        uint256 prevAccPmon = accPmon[version];
        uint256 newAccPmonPerShare;
        if (newAccPmon != prevAccPmon && totalUserShares > 0) {
            uint256 newReward = newAccPmon - prevAccPmon;
            newAccPmonPerShare =
                accPmonPerShare[version] +
                (newReward * PRECISION) /
                totalUserShares;
        } else {
            newAccPmonPerShare = accPmonPerShare[version];
        }

        // calculate rewards
        return
            (userShares[user] * newAccPmonPerShare) /
            PRECISION -
            userRewardDebt[version][user];
    }

    /// @notice Get information about a binder nft
    /// @param binderNftId id of the binder nft
    /// @return result BinderNftView struct with the binder nft information
    function getBinderNft(
        uint256 binderNftId
    ) external view returns (BinderNftView memory result) {
        result.id = binderNftId;
        result.shares = userShares[binderNft.ownerOf(binderNftId)];
        result.slots = new Nft[](slotDefinitions.length);
        for (uint256 i = 0; i < slotDefinitions.length; ) {
            result.slots[i] = binderNfts[binderNftId].slots[i];
            unchecked {
                i++;
            }
        }
        result.lockedNfts = binderNfts[binderNftId].lockedNfts;
    }
}
