// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IBinderNftParent {
    function prepareBinderNftTransfer(
        address from,
        address to,
        uint256 tokenId
    ) external;
}

/**
 * @title BinderNft.sol
 * @dev BinderNft.sol contract
 */
contract BinderNft is ERC721Enumerable {
    /***************************
     * EVENTS                  *
     ***************************/

    event BinderNftCreated(uint256 indexed id, address indexed owner);

    /***************************
     * STORAGE                 *
     ***************************/

    /// @dev id index for minting binderNfts
    uint256 public nftIndex;

    /// @dev parent binder contract
    address public parent;

    /***************************
     * Constructor             *
     ***************************/

    constructor(
        string memory name,
        string memory symbol,
        address _parent
    ) ERC721(name, symbol) {
        parent = _parent;
    }

    /***************************
     * PUBLIC EXT. FUNCTIONS   *
     ***************************/

    /// @notice Create a new empty binder nft
    /// @return id of the new binder nft
    function createBinderNft() external returns (uint256 id) {
        id = nftIndex++;
        _mint(msg.sender, id);
        emit BinderNftCreated(id, msg.sender);
    }

    /***************************
     * OVERRIDES               *
     ***************************/

    /// @dev See {IERC721-transferFrom}
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        IBinderNftParent(parent).prepareBinderNftTransfer(from, to, tokenId);
        super.transferFrom(from, to, tokenId);
    }

    /// @dev See {IERC721-safeTransferFrom}.
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) {
        IBinderNftParent(parent).prepareBinderNftTransfer(from, to, tokenId);
        super.safeTransferFrom(from, to, tokenId, data);
    }
}
