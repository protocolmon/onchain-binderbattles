// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../../metadata/IGen1CloneMetadata.sol";

interface ITraitProvider {
    function trait(
        uint256 tokenId,
        uint256 traitId
    ) external view returns (uint256);
}
