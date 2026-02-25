// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract MyNFT is ERC721, ERC2981, Ownable, ReentrancyGuard {
    using Strings for uint256;

    enum SaleState {
        Paused,
        Allowlist,
        Public
    }

    error InvalidSaleState();
    error InvalidQuantity();
    error InvalidPayment();
    error ExceedsWalletLimit();
    error ExceedsMaxSupply();
    error InvalidMerkleProof();
    error TransferFailed();

    uint256 public immutable maxSupply;
    uint256 public price;
    uint256 public maxPerWallet;

    bytes32 public merkleRoot;
    string public baseURI;
    string public revealedURI;
    bool public isRevealed;
    SaleState public saleState;

    uint256 private _nextTokenId;
    mapping(address => uint256) public mintedPerWallet;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        string memory revealedURI_,
        uint256 mintPrice_,
        uint256 maxPerWallet_,
        address royaltyReceiver_,
        uint96 royaltyFeeNumerator_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        maxSupply = 10_000;
        price = mintPrice_;
        maxPerWallet = maxPerWallet_;
        baseURI = baseURI_;
        revealedURI = revealedURI_;
        saleState = SaleState.Paused;
        _nextTokenId = 1;

        _setDefaultRoyalty(royaltyReceiver_, royaltyFeeNumerator_);
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }

    function setRevealedURI(string calldata newRevealedURI) external onlyOwner {
        revealedURI = newRevealedURI;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
    }

    function setSaleState(SaleState newState) external onlyOwner {
        saleState = newState;
    }

    function pause() external onlyOwner {
        saleState = SaleState.Paused;
    }

    function unpause(SaleState targetState) external onlyOwner {
        if (targetState == SaleState.Paused) revert InvalidSaleState();
        saleState = targetState;
    }

    function reveal() external onlyOwner {
        isRevealed = true;
    }

    function allowlistMint(bytes32[] calldata merkleProof, uint256 quantity) external payable {
        if (saleState != SaleState.Allowlist) revert InvalidSaleState();
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        bool isAllowlisted = MerkleProof.verify(merkleProof, merkleRoot, leaf);
        if (!isAllowlisted) revert InvalidMerkleProof();

        _mintTokens(msg.sender, quantity);
    }

    function publicMint(uint256 quantity) external payable {
        if (saleState != SaleState.Public) revert InvalidSaleState();
        _mintTokens(msg.sender, quantity);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory activeBase = isRevealed ? revealedURI : baseURI;
        return string.concat(activeBase, tokenId.toString(), ".json");
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _mintTokens(address to, uint256 quantity) internal {
        if (quantity == 0) revert InvalidQuantity();
        if (mintedPerWallet[to] + quantity > maxPerWallet) revert ExceedsWalletLimit();
        if (_nextTokenId + quantity - 1 > maxSupply) revert ExceedsMaxSupply();
        if (msg.value != price * quantity) revert InvalidPayment();

        mintedPerWallet[to] += quantity;
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(to, _nextTokenId);
            unchecked {
                _nextTokenId++;
            }
        }
    }
}
