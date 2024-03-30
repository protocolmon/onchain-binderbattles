// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PmonStore.sol";
import {IBinder} from "./interfaces/IBinder.sol";
import {IParentBinder} from "./interfaces/IParentBinder.sol";

/**
 * @title ParentBinder.sol
 * @dev ParentBinder.sol contract
 * Every mention of "share" in this contract does NOT relate to company or revenue shares.
 * It is simply a fraction of a whole.
 */
contract ParentBinder is
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

    struct VersionData {
        uint256 id;
        IParentBinder parentBinder;
    }

    /***************************
     * ERRORS                  *
     ***************************/

    error InvalidCaller(address expected, address actual);
    error AlreadyActivated();
    error VersionNotActivated();
    error InvalidTotalShares(uint256 expected, uint256 actual);

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
    event VersionAdded(
        uint256 indexed version,
        uint256 indexed id,
        IParentBinder indexed parentBinder
    );

    /***************************
     * CONSTANTS               *
     ***************************/

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    uint256 public constant BINDER_SHARE_DIVIDER = 10_000;

    /***************************
     * STORAGE                 *
     ***************************/

    /// @dev version => VersionData
    mapping(uint256 => VersionData) public versions;
    /// @dev version => binder ID => Binder
    mapping(uint256 => mapping(uint256 => Binder)) public binders;
    /// @dev version => timestamp
    mapping(uint256 => uint256) public versionActivatedAt;
    /// @dev version => binder count (used for binder ID)
    mapping(uint256 => uint256) public binderCount;

    /***************************
     * INITIALIZER             *
     ***************************/

    function initialize(address defaultAdmin) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(GOVERNANCE_ROLE, defaultAdmin);
    }

    /***************************
     * GOVERNANCE FUNCTIONS    *
     ***************************/

    /// @notice Add a binder to the pool that is not yet activated
    /// Can only be called by the governance role
    /// @param version version to add the binder to
    /// @param binder binder to add
    /// @param share share of the binder (fraction of BINDER_SHARE_DIVIDER)
    function addBinder(
        uint256 version,
        IBinder binder,
        uint256 share
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (versionActivatedAt[version] != 0) {
            revert AlreadyActivated();
        }
        uint256 id = binderCount[version]++;
        binders[version][id] = Binder(binder, share);
        emit BinderAdded(version, id, address(binder), share);
    }

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
        if (versionActivatedAt[version] != 0) {
            revert AlreadyActivated();
        }
        versions[version].id = id;
        versions[version].parentBinder = parentBinder;

        emit VersionAdded(version, id, parentBinder);
    }

    /// @notice Activate a version
    /// Can only be called by the governance role
    /// @param version version to activate
    function activateVersion(
        uint256 version
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (versionActivatedAt[version] != 0) {
            revert AlreadyActivated();
        }
        // ensure total binder shares for version are = BINDER_SHARE_DIVIDER
        uint256 totalShares;
        for (uint256 i = 0; i < binderCount[version]; i++) {
            totalShares += binders[version][i].share;
        }
        if (totalShares != BINDER_SHARE_DIVIDER) {
            revert InvalidTotalShares(BINDER_SHARE_DIVIDER, totalShares);
        }
        versionActivatedAt[version] = block.timestamp;
        emit VersionActivated(version, block.timestamp);
    }

    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    /// @inheritdoc IParentBinder
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

        VersionData memory versionData = versions[version];
        versionData.parentBinder.claimReward(
            version,
            versionData.id,
            user,
            amount
        );
    }

    /// @inheritdoc IParentBinder
    function getAndUpdateAccPmon(
        uint256 version,
        uint256 id
    ) external returns (uint256) {
        if (versionActivatedAt[version] == 0) {
            revert VersionNotActivated();
        }

        VersionData memory versionData = versions[version];
        uint accPmon = versionData.parentBinder.getAndUpdateAccPmon(
            version,
            versionData.id
        );
        uint256 shares = binders[version][id].share;
        return (accPmon * shares) / BINDER_SHARE_DIVIDER;
    }

    /***************************
     * VIEW FUNCTIONS          *
     ***************************/

    /// @inheritdoc IParentBinder
    function getAccPmon(
        uint256 version,
        uint256 id
    ) external view returns (uint256) {
        if (versionActivatedAt[version] == 0) {
            revert VersionNotActivated();
        }

        VersionData memory versionData = versions[version];
        uint256 accPmon = versionData.parentBinder.getAccPmon(
            version,
            versionData.id
        );
        uint256 shares = binders[version][id].share;
        return (accPmon * shares) / BINDER_SHARE_DIVIDER;
    }
}
