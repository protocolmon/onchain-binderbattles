// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IParentBinder {
    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    /// @notice Returns the accumulated PMON reward for a given binder (version, id)
    /// and save the updated values.
    /// @param version version of the share distribution
    /// @param id id of the binder for the specified version known by the parent binder
    /// @return accumulated PMON reward
    function getAndUpdateAccPmon(
        uint256 version,
        uint256 id
    ) external returns (uint256);

    /// @notice Transfers PMON from the pool for the specified version to the specified user.
    /// This function can only be called by the binder specified by the version and id.
    /// @param version version of the share distribution
    /// @param id id of the binder for the specified version known by the parent binder
    /// @param user user to transfer the PMON to
    /// @param reward amount of PMON to transfer
    function claimReward(
        uint256 version,
        uint256 id,
        address user,
        uint256 reward
    ) external;

    /***************************
     * VIEW FUNCTIONS          *
     ***************************/

    /// @notice Returns the accumulated PMON reward for a given binder (version, id)
    /// @param version version of the share distribution
    /// @param id id of the binder for the specified version known by the parent binder
    /// @return accumulated PMON reward
    function getAccPmon(
        uint256 version,
        uint256 id
    ) external view returns (uint256);
}
