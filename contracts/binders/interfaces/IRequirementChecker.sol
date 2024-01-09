// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

struct RequirementDefiniton {
    uint256 traitId;
    uint256[] acceptedTraitValues;
}

interface IRequirementChecker {
    function check(
        address tokenContract,
        uint256 tokenId,
        RequirementDefiniton[] calldata requirements
    ) external view returns (bool);
}
