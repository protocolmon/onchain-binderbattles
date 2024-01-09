// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PmonStore.sol
 * @dev PmonStore.sol contract
 * @notice This contract is used as the reward pool and should only be used for a single version.
 */
contract PmonStore {
    error InvalidCaller(address expected, address actual);

    /// @dev Top level binder that can transfer PMON from this contract
    address public topLevelBinder;
    /// @dev PMON Token
    IERC20 public pmon;

    constructor(address _topLevelBinder, IERC20 _pmon) {
        topLevelBinder = _topLevelBinder;
        pmon = _pmon;
    }

    /// @notice Transfers PMON from the pool to the specified user.
    /// This function can only be called by the top level binder.
    /// @param to user to transfer the PMON to
    /// @param amount amount of PMON to transfer
    function transferPmon(address to, uint256 amount) external {
        if (msg.sender != topLevelBinder) {
            revert InvalidCaller(topLevelBinder, msg.sender);
        }
        pmon.transfer(to, amount);
    }
}
