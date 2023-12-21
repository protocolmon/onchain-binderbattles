// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PmonStore.sol";
import {IBinder} from "./interfaces/IBinder.sol";
/**
 * @title TopLevelBinder.sol
 * @dev TopLevelBinder.sol contract
 * Every mention of "share" in this contract does NOT relate to company or revenue shares.
 * It is simply a fraction of a whole.
 */
contract TopLevelBinder is Initializable, AccessControlUpgradeable {
    struct Binder {
        IBinder binder;
        uint256 share;
    }
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    uint256 public constant BINDER_SHARE_DIVIDER = 10_000;
    /// @dev Version of the share distribution
    uint256 public currentVersion;
    /// @dev PMON Token
    IERC20 public pmon;
    /// @dev version => last PMON balance
    mapping(uint256 => uint256) public lastPmonBalance;
    /// @dev version => accumulated PMON per share
    mapping(uint256 => uint256) public accPmonPerShare;
    /// @dev version => binder ID => Binder
    mapping(uint256 => mapping(uint256 => Binder)) public binders;
    /// @dev version => timestamp
    mapping(uint256 => uint256) public versionActivatedAt;
    /// @dev version => binder count (used for binder ID)
    mapping(uint256 => uint256) public binderCount;
    /// @dev version => PMON store
    mapping(uint256 => PmonStore) public pmonStores;
    event BinderAdded(
        uint256 indexed version,
        uint256 indexed id,
        address indexed binder,
        uint256 share
    );
    event VersionActivated(uint256 indexed version, uint256 indexed timestamp);
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    function initialize(address defaultAdmin, IERC20 _pmon) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(GOVERNANCE_ROLE, defaultAdmin);
        pmon = _pmon;
    }
    /****************************
     * GOVERNANCE FUNCTIONS *
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
        uint256 version
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
        emit VersionActivated(version, block.timestamp);
    }
    /****************************
     * PUBLIC EXT. FUNCTIONS *
     ***************************/
    /// @dev Can be called by anyone
    function updateRewards(uint256 version) external {
        require(
            versionActivatedAt[version] != 0,
            "TopLevelBinder: Version not activated"
        );
        require(
            address(pmonStores[version]) != address(0),
            "TopLevelBinder: PMON store not set"
        );
        uint256 balance = pmon.balanceOf(address(pmonStores[version]));
        if (balance > lastPmonBalance[version]) {
            accPmonPerShare[version] +=
                (balance - lastPmonBalance[version]) /
                BINDER_SHARE_DIVIDER;
            lastPmonBalance[version] = balance;
        }
    }
}
