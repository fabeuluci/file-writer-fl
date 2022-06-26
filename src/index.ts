import * as fs from "fs";
import {flock} from "fs-ext";
import * as consts from "constants";
import {PromiseUtils} from "promise-utils-fl";

export class FileWriter {
    
    static async withLock(path: string, callback: (fd: number) => void|Promise<void>) {
        let fd = await PromiseUtils.cb2p<number>(x => fs.open(path, consts.O_RDWR | consts.O_CREAT, x));
        try {
            await PromiseUtils.cb2p(x => flock(fd, "ex", x));
            await callback(fd);
        }
        finally {
            await PromiseUtils.cb2p(x => fs.close(fd, x));
        }
    }
    
    static withBuffer(path: string, callback: (content: Buffer) => Buffer|Promise<Buffer>) {
        return FileWriter.withLock(path, async fd => {
            let stat = await PromiseUtils.cb2p<fs.Stats>(x => fs.fstat(fd, x));
            let fileContent = Buffer.alloc(stat.size);
            await PromiseUtils.cb2p(x => fs.read(fd, fileContent, 0, fileContent.length, 0, x));
            let newContent = await callback(fileContent);
            if (newContent != null) {
                await PromiseUtils.cb2p(x => fs.write(fd, newContent, 0, newContent.length, 0, x));
                await PromiseUtils.cb2p(x => fs.ftruncate(fd, newContent.length, x));
            }
        });
    }
    
    static withString(path: string, callback: (content: string) => string|Promise<string>) {
        return FileWriter.withBuffer(path, async buf => {
            let newContent = await callback(buf.toString("utf8"));
            return newContent == null ? null : Buffer.from(newContent, "utf8");
        });
    }
    
    static withJson<T = any>(path: string, callback: (content: T) => T|Promise<T>, pretty?: boolean) {
        return FileWriter.withString(path, async str => {
            let newContent = await callback(JSON.parse(str));
            return newContent == null ? null : (pretty ? JSON.stringify(newContent, null, 2) : JSON.stringify(newContent));
        });
    }
}