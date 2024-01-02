// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IBinder} from "./interfaces/IBinder.sol";
import {IParentBinder} from "./interfaces/IParentBinder.sol";

/**
 * @title Binder.sol
 * @dev Binder.sol contract
 */
contract Binder is Initializable, ERC721EnumerableUpgradeable, IBinder {
    /***************************
     * STRUCTS                 *
     ***************************/

    struct VersionData {
        uint256 id;
        IParentBinder parentBinder;
    }

    struct Nft {
        IERC721 tokenContract;
        uint256 tokenId;
    }

    struct BinderNft {
        mapping(uint256 => Nft) slots;
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

    /***************************
     * EVENTS                  *
     ***************************/

    event BinderNftCreated(uint256 indexed binderNftId, address indexed owner);
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

    /***************************
     * CONSTANTS               *
     ***************************/

    uint256 public constant PRECISION = 1e12;

    /***************************
     * STORAGE                 *
     ***************************/

    uint256 nftIndex;

    mapping(uint256 => VersionData) public versions;
    uint256[] public versionIds;

    /// @dev nftId => BinderNft data
    mapping(uint256 => BinderNft) binderNfts; // TODO add view

    uint256 public totalUserShares;
    /// @dev user address => shares
    mapping(address => uint256) public userShares;
    /// @dev version => accumulated pmon amount
    mapping(uint256 => uint256) public accPmon;
    /// @dev version => accumulated pmon per share
    mapping(uint256 => uint256) public accPmonPerShare;
    /// @dev version => user address => rewardDebt
    mapping(uint256 => mapping(address => uint256)) public userRewardDebt;

    /***************************
     * INITIALIZER             *
     ***************************/

    function initialize(
        string memory name,
        string memory symbol
    ) public initializer {
        __ERC721_init(name, symbol);
    }

    /***************************
     * GOVERNANCE FUNCTIONS    *
     ***************************/

    function addVersion(
        uint256 version,
        uint256 id,
        IParentBinder parentBinder
    ) external {
        // TODO add access control
        versions[version].id = id;
        versions[version].parentBinder = parentBinder;
        versionIds.push(version);
    }

    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    function createBinderNft() external returns (uint256 id) {
        id = nftIndex++;
        _mint(msg.sender, id);
        emit BinderNftCreated(id, msg.sender);
    }

    function stakeToBinderNft(
        uint256 nftId,
        NftInput[] calldata nfts,
        bool replace
    ) external {
        address owner = ownerOf(nftId);
        if (owner != msg.sender) {
            revert NotTheOwner(owner, msg.sender, nftId);
        }

        // transfer nfts and update slots
        uint256 numOfNfts = nfts.length;
        uint256 shares = 0;
        uint256 removedShares = 0;
        for (uint256 i = 0; i < numOfNfts; ) {
            NftInput memory nft = nfts[i];

            // TODO check slot requirements

            Nft memory slot = binderNfts[nftId].slots[nft.slotId];
            if (address(slot.tokenContract) != address(0)) {
                if (replace) {
                    nft.tokenContract.transferFrom(
                        address(this),
                        msg.sender,
                        nft.tokenId
                    );
                    // TODO use rarity as shares
                    removedShares += 1000;
                    // shares += getRarity(nfts[i]);

                    delete binderNfts[nftId].slots[nft.slotId];

                    emit NftRemoved(
                        nftId,
                        nft.slotId,
                        address(slot.tokenContract),
                        slot.tokenId
                    );
                } else {
                    revert InvalidSlot(nft.slotId);
                }
            }

            nft.tokenContract.transferFrom(
                msg.sender,
                address(this),
                nft.tokenId
            );
            // TODO use rarity as shares
            shares += 1000;
            // shares += getRarity(nft);

            binderNfts[nftId].slots[nft.slotId] = Nft({
                tokenContract: nft.tokenContract,
                tokenId: nft.tokenId
            });

            emit NftAdded(
                nftId,
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

        _updateRewardDebt();
    }

    function unstakeFromBinderNft(
        uint256 nftId,
        NftInput[] calldata nfts
    ) external {
        address owner = ownerOf(nftId);
        if (owner != msg.sender) {
            revert NotTheOwner(owner, msg.sender, nftId);
        }

        // transfer nfts and update slots
        uint256 numOfNfts = nfts.length;
        uint256 shares = 0;
        for (uint256 i = 0; i < numOfNfts; ) {
            NftInput memory nft = nfts[i];

            Nft memory slot = binderNfts[nftId].slots[nft.slotId];
            if (
                slot.tokenContract != nft.tokenContract ||
                slot.tokenId != nft.tokenId
            ) {
                revert InvalidSlot(nft.slotId);
            }

            nft.tokenContract.transferFrom(
                address(this),
                msg.sender,
                nft.tokenId
            );
            // TODO use rarity as shares
            shares += 1000;
            // shares += getRarity(nfts[i]);

            delete binderNfts[nftId].slots[nft.slotId];

            emit NftRemoved(
                nftId,
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

        _updateRewardDebt();
    }

    function claimReward(address user, uint256 version) external {
        if (userShares[user] == 0) {
            return;
        }

        updateReward(version);

        _claimReward(user, version);
    }

    function updateRewards() public {
        for (uint256 i = 0; i < versionIds.length; ) {
            updateReward(versionIds[i]);
            unchecked {
                i++;
            }
        }
    }

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

    /***************************
     * INTERNAL FUNCTIONS      *
     ***************************/

    function _updateRewardDebt() internal {
        for (uint256 i = 0; i < versionIds.length; ) {
            uint256 version = versionIds[i];
            userRewardDebt[version][msg.sender] =
                (userShares[msg.sender] * accPmonPerShare[version]) /
                PRECISION;
            unchecked {
                i++;
            }
        }
    }

    function _claimRewards(address user) internal {
        for (uint256 i = 0; i < versionIds.length; ) {
            _claimReward(user, versionIds[i]);
            unchecked {
                i++;
            }
        }
    }

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
}
