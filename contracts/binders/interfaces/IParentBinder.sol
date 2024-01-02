// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

interface IParentBinder {
    function getAndUpdateAccPmon(
        uint256 version,
        uint256 id
    ) external returns (uint256);
    function getAccPmon(
        uint256 version,
        uint256 id
    ) external view returns (uint256);
    function claimReward(
        uint256 version,
        uint256 id,
        address user,
        uint256 reward
    ) external;
}
