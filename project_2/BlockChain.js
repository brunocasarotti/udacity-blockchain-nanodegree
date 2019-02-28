/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

const Block = require('./Block.js');

const SHA256 = require('crypto-js/sha256');

const level = require('level');
const chainDB = './chaindata';

class Blockchain {

    constructor() {
        this.db = level(chainDB);
        this.getBlockHeight()
            .then((height) => {
                if (height == -1) {
                    this.generateGenesisBlock();
                }
            });
    }

    // Helper method to create a Genesis Block (always with height= 0)
    // You have to options, because the method will always execute when you create your blockchain
    // you will need to set this up statically or instead you can verify if the height !== 0 then you
    // will not create the genesis block
    generateGenesisBlock() {
        this.addBlock(new Block.Block("First block in the chain - Genesis block"));
    }

    // Get block height, it is a helper method that return the height of the blockchain
    async getBlockHeight() {
        let i = -1;
        return new Promise((resolve, reject) => {
            this.db.createReadStream()
                .on('data', function (data) {
                    i++;
                }).on('error', function (err) {
                    reject(err);
                }).on('close', function () {
                    resolve(i);
                });
        });
    }

    // Add new block
    async addBlock(newBlock) {
        newBlock.height = await this.getBlockHeight() + 1;
        // UTC timestamp
        newBlock.time = new Date().getTime().toString().slice(0, -3);
        // previous block hash
        if (newBlock.height > 0) {
            newBlock.previousBlockHash = (await this.getBlock(newBlock.height - 1)).hash;
        }
        // Block hash with SHA256 using newBlock and converting to a string
        newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
        // Adding block object to chain
        return this.addLevelDBData(newBlock.height, JSON.stringify(newBlock));
    }

    // Get Block By Height
    async getBlock(height) {
        return new Promise((resolve, reject) => {
            this.db.get(height, function (err, value) {
                if (err) {
                    console.log('Not found!', err);
                    reject(err);
                };
                resolve(JSON.parse(value));
            });
        })
    }

    // Validate if Block is being tampered by Block Height
    async validateBlock(height) {
        // get block object
        let block = await this.getBlock(height);
        // get block hash
        let blockHash = block.hash;
        // remove block hash to test block integrity
        block.hash = '';
        // generate block hash
        let validBlockHash = SHA256(JSON.stringify(block)).toString();

        return new Promise((resolve, reject) => {
            // Compare
            if (blockHash === validBlockHash) {
                resolve(true);
            } else {
                console.log('Block #' + height + ' invalid hash:\n' + blockHash + '<>' + validBlockHash);
                resolve(false);
            }
        });
    }

    // Validate Blockchain
    async validateChain() {
        let errorLog = [];
        let height = await this.getBlockHeight();
        for (var i = 0; i < height - 1; i++) {
            // validate block
            if (!await this.validateBlock(i)) errorLog.push(i);
            // compare blocks hash link
            let blockHash = (await this.getBlock(i)).hash;
            let previousHash = (await this.getBlock(i + 1)).previousBlockHash;
            if (blockHash !== previousHash) {
                errorLog.push(i);
            }
        }

        return new Promise((resolve, reject) => {
            resolve(errorLog);
        });
    }

    // Utility Method to Tamper a Block for Test Validation
    // This method is for testing purpose
    _modifyBlock(height, block) {
        let self = this;
        return new Promise((resolve, reject) => {
            self.addLevelDBData(height, JSON.stringify(block).toString())
                .then((blockModified) => {
                    resolve(blockModified);
                })
                .catch((err) => console.log(err));
        });
    }

    async addLevelDBData(key, value) {
        let self = this;
        return new Promise(function (resolve, reject) {
            self.db.put(key, value, function (err) {
                if (err) {
                    console.log('Block ' + key + ' submission failed', err);
                    reject(err);
                }
                resolve(value);
            });
        });
    }
}

module.exports.Blockchain = Blockchain;
