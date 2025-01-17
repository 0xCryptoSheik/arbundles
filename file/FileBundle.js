"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const FileDataItem_1 = tslib_1.__importDefault(require("./FileDataItem"));
const fs = tslib_1.__importStar(require("fs"));
const utils_1 = require("../build/utils");
const multistream_1 = tslib_1.__importDefault(require("multistream"));
const util_1 = require("util");
const base64url_1 = tslib_1.__importDefault(require("base64url"));
const promises_1 = require("stream/promises");
const arweave_stream_tx_1 = require("arweave-stream-tx");
const read = util_1.promisify(fs.read);
class FileBundle {
    headerFile;
    txs;
    constructor(headerFile, txs) {
        this.headerFile = headerFile;
        this.txs = txs;
    }
    static async fromDir(dir) {
        const txs = await fs.promises
            .readdir(dir)
            .then((r) => r.filter(async (f) => !(await fs.promises.stat(f).then((s) => s.isDirectory()))));
        return new FileBundle(dir + "/header", txs);
    }
    async length() {
        const handle = await fs.promises.open(this.headerFile, "r");
        const lengthBuffer = await read(handle.fd, Buffer.allocUnsafe(32), 0, 32, 0).then((r) => r.buffer);
        await handle.close();
        return utils_1.byteArrayToLong(lengthBuffer);
    }
    get items() {
        return this.itemsGenerator();
    }
    async get(index) {
        if (typeof index === "number") {
            if (index > (await this.length())) {
                throw new RangeError("Index out of range");
            }
            return this.getByIndex(index);
        }
        else {
            return this.getById(index);
        }
    }
    async getIds() {
        const ids = new Array(await this.length());
        let count = 0;
        for await (const { id } of this.getHeaders()) {
            ids[count] = id;
            count++;
        }
        return ids;
    }
    async getRaw() {
        const streams = [
            fs.createReadStream(this.headerFile),
            ...this.txs.map((t) => fs.createReadStream(t)),
        ];
        const stream = multistream_1.default.obj(streams);
        let buff = Buffer.allocUnsafe(0);
        for await (const chunk of stream) {
            buff = Buffer.concat([buff, Buffer.from(chunk)]);
        }
        return buff;
    }
    async toTransaction(arweave, jwk) {
        const streams = [
            fs.createReadStream(this.headerFile),
            ...this.txs.map((t) => fs.createReadStream(t)),
        ];
        const stream = multistream_1.default.obj(streams);
        const tx = await promises_1.pipeline(stream, arweave_stream_tx_1.createTransactionAsync({}, arweave, jwk));
        tx.addTag("Bundle-Format", "binary");
        tx.addTag("Bundle-Version", "2.0.0");
        return tx;
    }
    async signAndSubmit(arweave, jwk, tags = []) {
        const tx = await this.toTransaction(arweave, jwk);
        tx.addTag("Bundle-Format", "binary");
        tx.addTag("Bundle-Version", "2.0.0");
        for (const { name, value } of tags) {
            tx.addTag(name, value);
        }
        await arweave.transactions.sign(tx, jwk);
        const streams2 = [
            fs.createReadStream(this.headerFile),
            ...this.txs.map((t) => fs.createReadStream(t)),
        ];
        const stream2 = multistream_1.default.obj(streams2);
        await promises_1.pipeline(stream2, arweave_stream_tx_1.uploadTransactionAsync(tx, arweave, true));
        return tx;
    }
    async *getHeaders() {
        const handle = await fs.promises.open(this.headerFile, "r");
        for (let i = 32; i < 32 + 64 * (await this.length()); i += 64) {
            yield {
                offset: utils_1.byteArrayToLong(await read(handle.fd, Buffer.allocUnsafe(32), 0, 32, i).then((r) => r.buffer)),
                id: await read(handle.fd, Buffer.allocUnsafe(32), 0, 32, i + 32).then((r) => base64url_1.default.encode(r.buffer)),
            };
        }
        await handle.close();
    }
    async *itemsGenerator() {
        let counter = 0;
        for await (const { id } of this.getHeaders()) {
            yield new FileDataItem_1.default(this.txs[counter], base64url_1.default.toBuffer(id));
            counter++;
        }
    }
    async getById(txId) {
        let counter = 0;
        for await (const { id } of this.getHeaders()) {
            if (id === txId)
                return new FileDataItem_1.default(this.txs[counter], base64url_1.default.toBuffer(id));
            counter++;
        }
        throw new Error("Can't find by id");
    }
    async getByIndex(index) {
        let count = 0;
        for await (const { id } of this.getHeaders()) {
            if (count === index) {
                return new FileDataItem_1.default(this.txs[count], base64url_1.default.toBuffer(id));
            }
            count++;
        }
        throw new Error("Can't find by index");
    }
}
exports.default = FileBundle;
//# sourceMappingURL=FileBundle.js.map
