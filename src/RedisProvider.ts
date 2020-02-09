import * as vscode from "vscode";
import * as path from 'path';
import {RedisHandler} from "./RedisHandler";

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

export class RedisProvider implements  vscode.TreeDataProvider<Item>{
    private redisHandler: Map<string, RedisHandler> = new Map();
    private _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    constructor(){
        const configuration = vscode.workspace.getConfiguration();
		const list: string = (configuration.myRedis && configuration.myRedis.list) ? configuration.myRedis.list : "";
        list.split(';').forEach(item => {
            this.redisHandler.set(item,new RedisHandler());
        });
    }

    reset() {
        const configuration = vscode.workspace.getConfiguration();
		const list: string = (configuration.myRedis && configuration.myRedis.list) ? configuration.myRedis.list : "";
        list.split(';').forEach(item => {
            if (this.redisHandler.get(item)?.isConnected) {
                this.redisHandler.get(item)?.disconnect();
            }
        });

        this.redisHandler = new Map();
        list.split(';').forEach(item => {
            this.redisHandler.set(item,new RedisHandler());
        });
    }

    connectRedis(item: Item): void {
        console.log("Redis connect to : ", item.redisServer.address);
        this.redisHandler.get(item.redisServer.name)?.connect(item.redisServer.address, item.redisServer.password)
        .then(() => {
            this.refresh();
        });
    }

    public refresh(element?: Item) {
        if(element) {
            this._onDidChangeTreeData.fire(element);
        }else{
            this._onDidChangeTreeData.fire();
        }
        console.log("Refresh Fire");
        
    }

    public async getValue(element: Item): Promise<any> {
        return await this.redisHandler.get(element.redisServer.name)?.getValue(element.key);
    }

    public async setRedisValue(item: Item, value: any, type: string = "string") {
        if(await this.redisHandler.get(item.redisServer.name)?.existsKey(item.key)) {
            this.redisHandler.get(item.redisServer.name)?.setValue(item.key, value);
        }else {
            this.redisHandler.get(item.redisServer.name)?.addValue(item.key, value, type);
        }
    }

    public execCommand(item: Item, command: string) {
        this.redisHandler.get(item.redisServer.name)?.execCommand(command);
    }

    public deleteRedis(item: Item) {
        this.redisHandler.get(item.redisServer.name)?.delete(item.key);
    }

    async getTreeItem(element: Item): Promise<vscode.TreeItem> {
        if (!this.redisHandler?.get(element.redisServer.name)?.isConnected) {
            if (element.type === ItemType.Server) {
                let treeItem = new TreeItemNode(
                    element.key,
                    vscode.TreeItemCollapsibleState.None
                );
    
                treeItem.command = {
                    command: "redisExplorer.connectServer",
                    title: "Connect Server",
                    arguments: [
                        {
                            key: element.key,
                            value: "",
                            redisServer: element.redisServer,
                            type: element.type
                        }
                    ]
                };

                treeItem.iconPath = {
                    dark: path.join(__filename, '..', '..', 'media', 'light', 'server.svg'),
                    light: path.join(__filename, '..', '..', 'media', 'light', 'server.svg')
                };

                
                return treeItem;
            }
            return Promise.reject();
        }

        let treeItem = new TreeItemNode(
            element.name,
            element.type !== ItemType.Item
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None
        );

        let result;
        if (element.type === ItemType.Server) {
            result = await this.redisHandler?.get(element.redisServer.name)?.getInfo();
            treeItem.iconPath = {
                dark: path.join(__filename, '..', '..', 'media', 'light', 'server.svg'),
                light: path.join(__filename, '..', '..', 'media', 'light', 'server.svg')
            };
        } else if (element.type === ItemType.Item){
            result = await this.redisHandler?.get(element.redisServer.name)?.getValue(element.key);
        }

        if (element.type !== ItemType.Prefix) {
            treeItem.command = {
                command: "redisExplorer.readData",
                title: "Read Data",
                arguments: [
                {
                    key: element.key,
                    value: result,
                    redisServer: element.redisServer,
                    iconType: element.type
                }
                ]
            };
        }

        if (element.type === ItemType.Item) {
            treeItem.contextValue = "redisNode";
        } else if (element.type === ItemType.Server) {
            treeItem.contextValue = "redisServerNode";
        }

		return treeItem;
    }
    
    async getChildren(element: Item | undefined): Promise<Item[]> {
        if (!element) {
            const configuration = vscode.workspace.getConfiguration();
            if (configuration.myRedis.list !== "") {
                const listArray = configuration.myRedis.list.split(';');
                const addressArray = configuration.myRedis.address.split(';');
                const passwordArray = configuration.myRedis.password.split(';');
                let itemArray: Item[] = [];
                for(let i=0; i < listArray.length; i++) {
                    itemArray.push({name:listArray[i] ,key: listArray[i],value: "", redisServer: {name: listArray[i],address: addressArray[i], password: passwordArray[0]} ,type: ItemType.Server});
                }
                return itemArray;
            }else {
                return [];
            }
        } else if (element.type === ItemType.Server) {
            const result = await this.redisHandler.get(element.redisServer.name)?.getKeys();
            this.redisHandler.get(element.redisServer.name)?.setAllKeys(result);
            if (result !== undefined) {
                let itemList = result.map((value: string) => {
                    if (value.split(':').length === 1) {
                        return {name: value, key: value, value: "",redisServer: element.redisServer, type: ItemType.Item };
                    }else {
                        return {name: value.split(':')[0], key: value, value: "0",redisServer: element.redisServer, type: ItemType.Prefix };
                    }
                });
                let duplicateRemovalItemList: Item[] = [];
                itemList.forEach((value,index, array) => {
                    if(value.name !== array[index + 1]?.name) {
                        duplicateRemovalItemList.push(value);
                    }
                });
                return duplicateRemovalItemList;
            }
        }else if (element.type === ItemType.Prefix) {
            let itemList = this.redisHandler.get(element.redisServer.name)?.getKeysByPrefix(element, Number(element.value));
            let duplicateRemovalItemList: Item[] = [];
            if (itemList !== undefined) {
                itemList.forEach((value,index, array) => {
                    if(value.name !== array[index + 1]?.name) {
                        duplicateRemovalItemList.push(value);
                    }
                });
                return duplicateRemovalItemList;
            }
        }
        return [];
    }
}

export class TreeItemNode extends vscode.TreeItem {

	constructor(
		public label: string,
		public collapsibleState: vscode.TreeItemCollapsibleState,
	) {
		super(label, collapsibleState);
    }

	contextValue = 'item';

}