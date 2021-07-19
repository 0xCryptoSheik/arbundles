"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const base64url_1 = tslib_1.__importDefault(require("base64url"));
const buffer_1 = require("buffer");
const utils_1 = require("./utils");
const DataItem_1 = tslib_1.__importDefault(require("./DataItem"));
const transaction_1 = require("arweave/node/lib/transaction");
const HEADER_START = 32;
class Bundle {
    constructor(binary, verify) {
        // TODO: Add some verification
        if (verify) {
            if (!Bundle._verify(binary))
                throw new Error("Binary not valid bundle");
        }
        this.binary = binary;
    }
    get length() { return this.getDataItemCount(); }
    /**
     * Get a DataItem by index (`number`) or by txId (`string`)
     * @param index
     */
    get(index) {
        if (typeof index === "number") {
            if (index > this.length) {
                throw new RangeError("Index out of range");
            }
            return this.getByIndex(index);
        }
        else {
            return this.getById(index);
        }
    }
    getAll() {
        const items = new Array(this.length);
        let offset = 0;
        const bundleStart = this.getBundleStart();
        let counter = 0;
        for (let i = HEADER_START; i < (HEADER_START + (64 * this.length)); i += 64) {
            const _offset = utils_1.byteArrayToLong(this.binary.slice(i, i + 32));
            const dataItemStart = bundleStart + offset;
            const bytes = this.binary.slice(dataItemStart, dataItemStart + _offset);
            offset += _offset;
            items[counter] = new DataItem_1.default(bytes);
            counter++;
        }
        return items;
    }
    toTransaction(arweave) {
        return arweave.createTransaction({
            data: this.binary,
            tags: [
                new transaction_1.Tag("Bundle-Format", "binary"),
                new transaction_1.Tag("Bundle-Version", "2.0.0"),
            ]
        });
    }
    verify() {
        return Bundle._verify(this.binary);
    }
    static _verify(_) {
        return true;
    }
    getOffset(id) {
        let offset = 0;
        for (let i = HEADER_START; i < (HEADER_START + (64 * this.length)); i += 64) {
            const _offset = utils_1.byteArrayToLong(this.binary.slice(i, i + 32));
            offset += _offset;
            const _id = this.binary.slice(i + 32, i + 64);
            if (utils_1.arraybufferEqual(_id, id)) {
                return { startOffset: offset, size: _offset };
            }
        }
        return { startOffset: -1, size: -1 };
    }
    // TODO: Test this
    /**
     * UNSAFE! Assumes index < length
     * @param index
     * @private
     */
    getByIndex(index) {
        let offset = 0;
        const headerStart = 32 + (64 * index);
        const dataItemSize = utils_1.byteArrayToLong(this.binary.slice(headerStart, headerStart + 32));
        let counter = 0;
        for (let i = HEADER_START; i < (HEADER_START + (64 * this.length)); i += 64) {
            if (counter == index) {
                break;
            }
            const _offset = utils_1.byteArrayToLong(this.binary.slice(i, i + 32));
            offset += _offset;
            counter++;
        }
        const bundleStart = this.getBundleStart();
        const dataItemStart = bundleStart + offset;
        return new DataItem_1.default(this.binary.slice(dataItemStart, dataItemStart + dataItemSize));
    }
    getById(id) {
        const _id = Uint8Array.from(buffer_1.Buffer.from(base64url_1.default.decode(id, "hex")));
        const offset = this.getOffset(_id);
        if (offset.startOffset == -1) {
            throw new Error("Transaction not found");
        }
        const bundleStart = this.getBundleStart();
        const dataItemStart = bundleStart + offset.startOffset;
        return new DataItem_1.default(this.binary.slice(dataItemStart, dataItemStart + offset.size));
    }
    getDataItemCount() {
        return utils_1.byteArrayToLong(this.binary.slice(0, 32));
    }
    getBundleStart() {
        return 32 + (64 * this.length);
    }
}
exports.default = Bundle;
//# sourceMappingURL=Bundle.js.map