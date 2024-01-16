// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "../../metadata/IGen1CloneMetadata.sol";

interface IRarityProvider {
    function rarity(uint256 tokenId) external view returns (uint256);
}
