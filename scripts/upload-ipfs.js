const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

async function uploadFolderToPinata(folderPath) {
  const apiKey = process.env.PINATA_API_KEY;
  const secretApiKey = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !secretApiKey) {
    throw new Error("Missing PINATA_API_KEY or PINATA_SECRET_API_KEY");
  }

  const formData = new FormData();

  const files = fs.readdirSync(folderPath);
  for (const fileName of files) {
    const filePath = path.join(folderPath, fileName);
    if (fs.statSync(filePath).isFile()) {
      formData.append("file", fs.createReadStream(filePath), {
        filepath: fileName
      });
    }
  }

  const response = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
    maxBodyLength: Infinity,
    headers: {
      ...formData.getHeaders(),
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretApiKey
    }
  });

  return response.data.IpfsHash;
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error("Usage: node scripts/upload-ipfs.js <folder-path>");
    process.exit(1);
  }

  const folderPath = path.resolve(folderArg);
  if (!fs.existsSync(folderPath)) {
    console.error("Folder does not exist:", folderPath);
    process.exit(1);
  }

  const cid = await uploadFolderToPinata(folderPath);
  console.log("IPFS CID:", cid);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
