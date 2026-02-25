const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");

function hashAddress(address) {
  const hash = ethers.solidityPackedKeccak256(["address"], [address]);
  return Buffer.from(hash.slice(2), "hex");
}

describe("MyNFT", function () {
  async function deployFixture() {
    const [owner, allowlistedUser, user2, user3] = await ethers.getSigners();

    const addresses = [allowlistedUser.address, user2.address];
    const leaves = addresses.map((address) => hashAddress(address));
    const tree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    const Contract = await ethers.getContractFactory("MyNFT");
    const contract = await Contract.deploy(
      "Generative Launchpad NFT",
      "GLNFT",
      "ipfs://UNREVEALED_CID/",
      "ipfs://REVEALED_CID/",
      ethers.parseEther("0.01"),
      3,
      owner.address,
      500
    );
    await contract.waitForDeployment();
    await contract.setMerkleRoot(root);

    return { contract, owner, allowlistedUser, user2, user3, tree };
  }

  it("supports ERC721 and ERC2981 interfaces", async function () {
    const { contract } = await deployFixture();
    expect(await contract.supportsInterface("0x80ac58cd")).to.equal(true);
    expect(await contract.supportsInterface("0x2a55205a")).to.equal(true);
  });

  it("allows owner-only configuration setters", async function () {
    const { contract, owner, user3 } = await deployFixture();

    await expect(contract.connect(user3).setPrice(123)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );
    await expect(contract.connect(user3).setBaseURI("ipfs://x/")).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );
    await expect(contract.connect(user3).setRevealedURI("ipfs://y/")).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );
    await expect(contract.connect(user3).setMerkleRoot(ethers.ZeroHash)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );
    await expect(contract.connect(user3).setSaleState(1)).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );

    await contract.connect(owner).setPrice(123);
    await contract.connect(owner).setBaseURI("ipfs://new-base/");
    await contract.connect(owner).setRevealedURI("ipfs://new-reveal/");
    await contract.connect(owner).setMerkleRoot(ethers.ZeroHash);
    await contract.connect(owner).setSaleState(2);

    expect(await contract.price()).to.equal(123);
    expect(await contract.baseURI()).to.equal("ipfs://new-base/");
    expect(await contract.revealedURI()).to.equal("ipfs://new-reveal/");
    expect(await contract.merkleRoot()).to.equal(ethers.ZeroHash);
    expect(await contract.saleState()).to.equal(2);
  });

  it("allowlistMint verifies proof and sale state", async function () {
    const { contract, allowlistedUser, user3, tree } = await deployFixture();
    const proof = tree.getHexProof(hashAddress(allowlistedUser.address));

    await expect(
      contract.connect(allowlistedUser).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");

    await contract.setSaleState(1);

    await expect(
      contract.connect(allowlistedUser).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") })
    ).to.not.be.reverted;

    expect(await contract.totalSupply()).to.equal(1);

    await expect(
      contract.connect(allowlistedUser).allowlistMint([], 1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidMerkleProof");

    await expect(
      contract.connect(user3).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidMerkleProof");

    await contract.setSaleState(2);
    await expect(
      contract.connect(allowlistedUser).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");
  });

  it("publicMint enforces state and per-wallet cap", async function () {
    const { contract, user3 } = await deployFixture();

    await expect(
      contract.connect(user3).publicMint(1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");

    await contract.setSaleState(2);
    await expect(
      contract.connect(user3).publicMint(2, { value: ethers.parseEther("0.02") })
    ).to.not.be.reverted;

    await expect(
      contract.connect(user3).publicMint(2, { value: ethers.parseEther("0.02") })
    ).to.be.revertedWithCustomError(contract, "ExceedsWalletLimit");

    await contract.setSaleState(1);
    await expect(
      contract.connect(user3).publicMint(1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");
  });

  it("supports reveal flow with tokenURI switching", async function () {
    const { contract, owner, user3 } = await deployFixture();
    await contract.setSaleState(2);
    await contract.connect(user3).publicMint(1, { value: ethers.parseEther("0.01") });

    expect(await contract.tokenURI(1)).to.equal("ipfs://UNREVEALED_CID/1.json");

    await expect(contract.connect(user3).reveal()).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );

    await contract.connect(owner).reveal();
    expect(await contract.tokenURI(1)).to.equal("ipfs://REVEALED_CID/1.json");
  });

  it("pause/unpause and withdraw work securely", async function () {
    const { contract, owner, allowlistedUser, user3, tree } = await deployFixture();
    const proof = tree.getHexProof(hashAddress(allowlistedUser.address));

    await contract.setSaleState(1);
    await contract.connect(allowlistedUser).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") });

    await contract.pause();
    await expect(
      contract.connect(allowlistedUser).allowlistMint(proof, 1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");
    await expect(
      contract.connect(user3).publicMint(1, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWithCustomError(contract, "InvalidSaleState");

    await contract.unpause(2);
    await contract.connect(user3).publicMint(1, { value: ethers.parseEther("0.01") });

    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
    const contractBalanceBefore = await ethers.provider.getBalance(await contract.getAddress());
    expect(contractBalanceBefore).to.equal(ethers.parseEther("0.02"));

    await expect(contract.connect(user3).withdraw()).to.be.revertedWithCustomError(
      contract,
      "OwnableUnauthorizedAccount"
    );

    const tx = await contract.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    const contractBalanceAfter = await ethers.provider.getBalance(await contract.getAddress());

    expect(contractBalanceAfter).to.equal(0);
    expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + contractBalanceBefore - gasCost);
  });
});
