const fs = require("fs");
const path = require("path");
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");
const { solidityPackedKeccak256 } = require("ethers");

function hashAddress(addr) {
  const hash = solidityPackedKeccak256(["address"], [addr]);
  return Buffer.from(hash.slice(2), "hex");
}

function main() {
  const allowlistPath = path.join(__dirname, "..", "allowlist.json");
  const addresses = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  const leaves = addresses.map((address) => hashAddress(address));

  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  console.log(root);
}

main();
