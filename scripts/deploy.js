const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const Contract = await ethers.getContractFactory("MyNFT");
  const contract = await Contract.deploy(
    "Generative Launchpad NFT",
    "GLNFT",
    "ipfs://UNREVEALED_CID/",
    "ipfs://REVEALED_CID/",
    ethers.parseEther("0.01"),
    5,
    deployer.address,
    500
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log("MyNFT deployed to:", contractAddress);

  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "MyNFT.sol", "MyNFT.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const frontendContractsDir = path.join(__dirname, "..", "frontend", "contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendContractsDir, "MyNFT.json"),
    JSON.stringify({ abi: artifact.abi }, null, 2)
  );

  console.log("ABI exported to frontend/contracts/MyNFT.json");
  console.log("Set NEXT_PUBLIC_CONTRACT_ADDRESS=", contractAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
