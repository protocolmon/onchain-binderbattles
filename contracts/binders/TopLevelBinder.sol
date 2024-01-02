// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PmonStore.sol";
import {IBinder} from "./interfaces/IBinder.sol";
import {IParentBinder} from "./interfaces/IParentBinder.sol";

/**
 * @title TopLevelBinder.sol
 * @dev TopLevelBinder.sol contract
 * Every mention of "share" in this contract does NOT relate to company or revenue shares.
 * It is simply a fraction of a whole.
 */
contract TopLevelBinder is
    Initializable,
    AccessControlUpgradeable,
    IParentBinder
{
    /***************************
     * STRUCTS                 *
     ***************************/

    struct Binder {
        IBinder binder;
        uint256 share;
    }

    struct Rewards {
        PmonStore pmonStore;
        uint256 lastPmonBalance;
        uint256 accPmonPerShare;
    }

    /***************************
     * ERRORS                  *
     ***************************/

    error InvalidCaller(address expected, address actual);

    /***************************
     * EVENTS                  *
     ***************************/

    event BinderAdded(
        uint256 indexed version,
        uint256 indexed id,
        address indexed binder,
        uint256 share
    );
    event VersionActivated(uint256 indexed version, uint256 indexed timestamp);

    /***************************
     * CONSTANTS               *
     ***************************/

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    uint256 public constant BINDER_SHARE_DIVIDER = 10_000;

    /***************************
     * STORAGE                 *
     ***************************/

    /// @dev Version of the share distribution
    uint256 public currentVersion;
    /// @dev PMON Token
    IERC20 public pmon;
    /// @dev version => binder ID => Binder
    mapping(uint256 => mapping(uint256 => Binder)) public binders;
    /// @dev version => timestamp
    mapping(uint256 => uint256) public versionActivatedAt;
    /// @dev version => binder count (used for binder ID)
    mapping(uint256 => uint256) public binderCount;
    /// @dev version => Reward data
    mapping(uint256 => Rewards) public rewards;

    function initialize(address defaultAdmin, IERC20 _pmon) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(GOVERNANCE_ROLE, defaultAdmin);
        pmon = _pmon;
    }

    /***************************
     * GOVERNANCE FUNCTIONS    *
     ***************************/

    function addBinder(
        uint256 version,
        IBinder binder,
        uint256 share
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(
            versionActivatedAt[version] == 0,
            "TopLevelBinder: Already activated"
        );
        uint256 id = binderCount[version]++;
        binders[version][id] = Binder(binder, share);
        emit BinderAdded(version, id, address(binder), share);
    }

    function activateVersion(
        uint256 version,
        PmonStore pmonStore
    ) external onlyRole(GOVERNANCE_ROLE) {
        // ensure total binder shares for version are = BINDER_SHARE_DIVIDER
        uint256 totalShares;
        for (uint256 i = 0; i < binderCount[version]; i++) {
            totalShares += binders[version][i].share;
        }
        require(
            totalShares == BINDER_SHARE_DIVIDER,
            "TopLevelBinder: Invalid total shares"
        );
        versionActivatedAt[version] = block.timestamp;
        rewards[version].pmonStore = pmonStore;
        emit VersionActivated(version, block.timestamp);
    }

    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    /// @dev Can be called by anyone
    function updateRewards(uint256 version) public {
        require(
            versionActivatedAt[version] != 0,
            "TopLevelBinder: Version not activated"
        );
        Rewards memory rewardData = rewards[version];
        require(
            address(rewardData.pmonStore) != address(0),
            "TopLevelBinder: PMON store not set"
        );
        uint256 balance = pmon.balanceOf(address(rewardData.pmonStore));
        if (balance > rewardData.lastPmonBalance) {
            rewards[version].accPmonPerShare +=
                (balance - rewardData.lastPmonBalance) /
                BINDER_SHARE_DIVIDER;
            rewards[version].lastPmonBalance = balance;
        }
    }

    function claimReward(
        uint256 version,
        uint256 id,
        address user,
        uint256 amount
    ) external {
        if (msg.sender != address(binders[version][id].binder)) {
            revert InvalidCaller(
                address(binders[version][id].binder),
                msg.sender
            );
        }

        if (amount > 0) {
            // rewards[version].pmonStore.transfer(user, amount);
            // rewards[version].lastPmonBalance -= amount;
        }
    }

    function getAndUpdateAccPmon(
        uint256 version,
        uint256 id
    ) external returns (uint256) {
        updateRewards(version);
        return rewards[version].accPmonPerShare * binders[version][id].share;
    }

    /***************************
     * VIEW FUNCTIONS          *
     ***************************/

    function getAccPmon(
        uint256 version,
        uint256 id
    ) external view returns (uint256) {
        require(
            versionActivatedAt[version] != 0,
            "TopLevelBinder: Version not activated"
        );

        Rewards memory rewardData = rewards[version];

        uint256 balance = pmon.balanceOf(address(rewardData.pmonStore));
        uint256 newAccPmonPerShare = rewardData.accPmonPerShare +
            (balance - rewardData.lastPmonBalance) /
            BINDER_SHARE_DIVIDER;

        return newAccPmonPerShare * binders[version][id].share;
    }
}
