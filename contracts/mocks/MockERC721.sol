// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    uint256 public tokenIndex;

    mapping(uint256 => mapping(uint256 => uint256)) traits;
    mapping(uint256 => uint256) rarities;

    constructor() ERC721("Test", "Test") {}

    function mint(address to, uint256[] calldata _traits, uint256 rarity) external {
        uint256 index = tokenIndex++;
        _mint(to, index);
        for (uint256 i = 0; i < _traits.length; i++) {
            traits[index][i] = _traits[i];
        }
        rarities[index] = rarity;
    }

    function trait(
        uint256 tokenId,
        uint256 traitId
    ) external view returns (uint256) {
        return traits[tokenId][traitId];
    }

    function rarity(uint256 tokenId) external view returns (uint256) {
        return rarities[tokenId];
    }
}
