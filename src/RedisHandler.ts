var Redis = require("ioredis");
import * as vscode from "vscode";

enum ItemType {
    Server = 0,
    Item = 1,
    Prefix = 2
}

interface RedisServer {
    name: string;
    address: string;
    password: string;
}

interface Item {
    name: string;
    key: string;
    value: string;
    redisServer: RedisServer;
    type: ItemType;
}

export class RedisHandler {

    private redisClient: any = undefined;
    private cluster: boolean = false;
    private allKeys: string[] | undefined = [];

    connect(redisString: string, password?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // example: 127.0.0.1:6379,127.0.0.1:8888  => ["127.0.0.1:6379","127.0.0.1:8888"]
            let redisAddress = redisString.split(',');
            if(redisAddress.length === 1) {
                this.redisClient = new Redis({
                    port: redisAddress[0].split(':')[1],
                    host: redisAddress[0].split(':')[0],
                    password: password,
                    retryStrategy: function(times: number) {
                        if(times < 5) {
                            var delay = Math.min(times * 50, 2000);
                            return delay;
                        }else {
                            vscode.window.showErrorMessage(`I can not connect redis😢,maybe redis is't running`);
                            return null;
                        }
                    }
                });
            }else if(redisAddress.length > 1) {
                let options: any = [];
                redisAddress.forEach(item => {
                    options.push({
                        port: item.split(':')[1],
                        host: item.split(':')[0]
                    });
                });
                this.redisClient = new Redis.Cluster(options,{
                    scaleReads: "slave",
                    redisOptions: {
                        password: password
                    },
                    clusterRetryStrategy: function(times: number) {
                        if(times < 5) {
                            var delay = Math.min(100 + times * 2, 2000);
                            return delay;
                        }else {
                            vscode.window.showErrorMessage(`I can not connect redis cluster😢,maybe redis is't running`);
                            return null;
                        }
                    }
                });
                this.cluster = true;
            }else {
                console.log("redis address is incorrect😢");
                reject();
            }

            this.redisClient.on("ready", () => {
                console.log("Redis Connected");
                resolve();
            });

            this.redisClient.on("error", (error: any) => {
                console.log("something went wrong:" + error);
                resolve();
            });
        });
    }

    disconnect(): void {
        if (this.redisClient) {
            this.redisClient.disconnect();
        }
    }

    get isConnected(): boolean {
        if(this.redisClient && this.redisClient.status === "ready"){
            return true;
        }
        return false;
    }

    getKeysByPrefix(element: Item, index: number): Item[] {
        let output: Item[] = [];
        if (this.allKeys !== undefined) {
            this.allKeys.forEach(item => {
                if(item.split(':')[index] === element.name) {
                    if (item.split(':').length === (index + 1 + 1)) {
                        output.push({
                            name: item.split(':')[index + 1],
                            key: item,
                            value: "",
                            redisServer: element.redisServer, 
                            type: ItemType.Item,
                        });
                    }else if (item.split(':').length > (index + 1 + 1)){
                        output.push({
                            name: item.split(':')[index + 1],
                            key: item,
                            value: (index + 1).toString(),
                            redisServer: element.redisServer, 
                            type: ItemType.Prefix,
                        });
                    }
                }
            });
        }
        return output;
    }

    setAllKeys(element: string[] | undefined) {
        this.allKeys = element;
    }

    public execCommand(command: string): Promise<string[]> {
        if(!this.isConnected) {
            Promise.reject();
        }

        return new Promise<string[]>((resolve, reject) => {
            this.redisClient.send_command(command.split(" ").slice(0,1).toString(),command.split(" ").slice(1)).then((result: any) => {
                resolve(result);
           }).catch((error: any) => {
                reject(error);
           });
        });
    }

    private async scanKeys(node: any): Promise<string[]> {
        if(!this.isConnected) {
            Promise.reject();
        }

        return new Promise<string[]>((resolve, reject) => {
            let stream = node.scanStream({ count: 10000 });
            let itemList: any[] = [];
            stream.on("data", (resultKeys: any) => {
                itemList = itemList.concat(resultKeys);
            });
            stream.on("end", () => {
                resolve(itemList.sort());
            });
        });
    }

    async getKeys(): Promise<string[]> {
        if(!this.isConnected) {
            Promise.reject();
        }

        try {
            return new Promise<string[]>((resolve, reject) => {
                if (!this.cluster) {
                    this.scanKeys(this.redisClient).then( keys => {
                        resolve(keys);
                    });
                }
                else {
                    let masters = this.redisClient.nodes("master");
                    Promise.all(masters.map((node: any) => {
                        return this.scanKeys(node);
                    })).then(keys => {
                        let itemList_1: any[] = [];
                        keys.forEach(node => {
                            itemList_1 = itemList_1.concat(node);
                        });
                        resolve(itemList_1.sort());
                    }).catch(error => {
                        reject(error);
                    });
                }
            });
        }
        catch (e) {
            return [];
        }
    }

    async getValue(key: string): Promise<any> {
        if (!this.isConnected) {
             return Promise.reject(); 
        }

        try {
            return new Promise<any>((resolve, reject) => {
                this.redisClient.type(key).then((result: any) => {
                    switch (result) {
                        case "string":
                            this.redisClient.get(key).then((resp: any) => {
                                resolve(resp);
                            });
                            break;
                        case "list":
                            this.redisClient.lrange(key, 0, -1).then((resp: any) => {
                                resolve(resp);
                            });
                            break;
                        case "set":
                            this.redisClient.smembers(key).then((resp: any) => {
                                resolve(resp);
                            });
                            break;
                        case "zset":
                            this.redisClient.zrange(key, 0, -1, 'WITHSCORES').then((resp: any) => {
                                resolve(resp);
                            });
                            break;
                        case "hash":
                            this.redisClient.hgetall(key).then((resp: any) => {
                                resolve(resp);
                            });
                            break;
                        default:
                            reject();
                            break;
                    }
                    return;
                });
            });
        }
        catch (e) {
            console.log(e);
            return {};
        }
    }

    async existsKey(...keys: string[]): Promise<number> {
        return await this.redisClient.exists(keys);
    }

    addValue(key: string, value: any, type: string) {
        if (!this.isConnected) {
            vscode.window.showErrorMessage(`redis is unconnected😢`);
            return; 
        }

        try {
            switch (type) {
                case "string":
                    this.redisClient.set(key, value).catch((err: any) => {
                        vscode.window.showErrorMessage(`addkey error😢:${err}, example of value: 
                        value`);
                    });
                    break;
                case "list":
                    this.redisClient.multi().del(key).rpush(key,JSON.parse(value.toString())).exec((err: any, results: any) => {
                        if(err !== null) {
                            vscode.window.showErrorMessage(`addkey error😢:${err.previousErrors[0]}`);
                        }
                    });
                    break;
                case "set":
                    this.redisClient.multi().del(key).sadd(key, JSON.parse(value.toString())).exec((err: any, results: any) => {
                        if(err !== null) {
                            vscode.window.showErrorMessage(`addkey error😢:${err.previousErrors[0]}`);
                        }
                    });
                    break;
                case "zset":
                    this.redisClient.multi().del(key).zadd(key,JSON.parse(value.toString()).reverse()).exec((err: any, results: any) => {
                        if(err !== null) {
                            vscode.window.showErrorMessage(`addkey error😢:${err.previousErrors[0]}`);
                        }
                    });
                    break;
                case "hash":
                    const readData = JSON.parse(value.toString());
                    let keys = Object.keys(readData);
                    let convertArr = new Map();
                    for (let key of keys) {
                        convertArr.set(key,readData[key]);
                    }
                    this.redisClient.multi().del(key).hmset(key,convertArr).exec((err: any, results: any) => {
                        if(err !== null) {
                            vscode.window.showErrorMessage(`addkey error😢:${err}`);
                        }
                    });
                    break;
                default:
                    vscode.window.showErrorMessage(`unknow type of key😵:${type}. only support string, list, set, zset, hash`);
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`addkey error😢:${error}`);
        }
    }

    setValue(key: string, value: any) {
        if (!this.isConnected) {
            vscode.window.showErrorMessage(`redis is unconnected😢`);
            return; 
        }
        
        this.redisClient.type(key).then((result: any) => {
            try {
                switch (result) {
                    case "string":
                        this.redisClient.set(key, value).catch((err: any) => {
                            vscode.window.showErrorMessage(`save redis key error😢:${err}`);
                        });
                        break;
                    case "list":
                        this.redisClient.multi().del(key).rpush(key,JSON.parse(value.toString())).exec((err: any, results: any) => {
                            if(err !== null) {
                                vscode.window.showErrorMessage(`save redis key error😢:${err.previousErrors[0]}`);
                            }
                        });
                        break;
                    case "set":
                        this.redisClient.multi().del(key).sadd(key, JSON.parse(value.toString())).exec((err: any, results: any) => {
                            if(err !== null) {
                                vscode.window.showErrorMessage(`save redis key error😢:${err.previousErrors[0]}`);
                            }
                        });
                        break;
                    case "zset":
                        this.redisClient.multi().del(key).zadd(key,JSON.parse(value.toString()).reverse()).exec((err: any, results: any) => {
                            if(err !== null) {
                                vscode.window.showErrorMessage(`save redis key error😢:${err.previousErrors[0]}`);
                            }
                        });
                        break;
                    case "hash":
                        const readData = JSON.parse(value.toString());
                        let keys = Object.keys(readData);
                        let convertArr = new Map();
                        for (let key of keys) {
                            convertArr.set(key,readData[key]);
                        }
                        this.redisClient.multi().del(key).hmset(key,convertArr).exec((err: any, results: any) => {
                            if(err !== null) {
                                vscode.window.showErrorMessage(`save redis key error😢:${err}`);
                            }
                        });
                        break;
                    default:
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`save redis key error😢:${error}`);
            }
        }).catch((error: any) => {
            vscode.window.showErrorMessage(`save redis key error😢:${error}`);
        });
    }

    async getInfo(): Promise<string> {
        if (!this.isConnected) { 
            return Promise.reject(); 
        }
    
        try {
            return new Promise<string>((resolve, reject) => {
                this.redisClient.info().then((result: string | PromiseLike<string> | undefined) => {
                    resolve(result);
                }).catch((err: any) => {
                    reject(err);
                    return "";
                });
            });
        }
        catch (e) {
            return "";
        }
    }

    delete(key: string) {
        if (!this.isConnected) { return; }
        this.redisClient.del(key);
    }
}