// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "./interfaces/ITraitProvider.sol";
import "./interfaces/IRequirementChecker.sol";

contract RequirementChecker is IRequirementChecker {
    mapping(address => bool) public whitelistedNftContracts;

    function whitelistNftContract(address nftContract) external {
        // TODO access control
        whitelistedNftContracts[nftContract] = true;
    }

    function check(
        address tokenContract,
        uint256 tokenId,
        RequirementDefiniton[] calldata requirements
    ) external view returns (bool) {
        if (!whitelistedNftContracts[tokenContract]) {
            return false;
        }

        if (requirements.length == 0) {
            return true;
        }

        for (uint256 i = 0; i < requirements.length; ) {
            RequirementDefiniton memory requirement = requirements[i];
            uint256 traitValue = ITraitProvider(tokenContract).trait(
                tokenId,
                requirement.traitId
            );

            bool foundMatch = false;
            for (uint256 j = 0; j < requirement.acceptedTraitValues.length; ) {
                if (traitValue == requirement.acceptedTraitValues[j]) {
                    foundMatch = true;
                    break;
                }

                unchecked {
                    j++;
                }
            }

            if (!foundMatch) {
                return false;
            }

            unchecked {
                i++;
            }
        }

        return true;
    }
}
