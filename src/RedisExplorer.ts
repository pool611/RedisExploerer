import * as vscode from "vscode";
import { RedisProvider, TreeItemNode } from "./RedisProvider";
import fs = require("fs");

enum ItemType {
  Server = 0,
  Item = 1
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

const redisDummyFile = ".vscode/.myRedis.redis";

export class RedisExplorer {

    treeDataProvider: RedisProvider;
    lastResource: any;
    rootPath: string;

    constructor(context: vscode.ExtensionContext){
        this.treeDataProvider = new RedisProvider();

        if(vscode.workspace.workspaceFolders) {
          const workspaceFolder = vscode.workspace.workspaceFolders.filter(folder => folder.uri.scheme === 'file')[0];
          if (workspaceFolder) {
            this.rootPath = workspaceFolder.uri.fsPath;
            // 判断是否存在临时文件（用于显示key值）
            if (!fs.existsSync(`${this.rootPath}/.vscode`)) {
              // 创建目录
              fs.mkdirSync(`${this.rootPath}/.vscode`);
            }
            if (fs.existsSync(`${this.rootPath}/${redisDummyFile}`)) {
              // 删除旧文件
              fs.unlink(`${this.rootPath}/${redisDummyFile}`, err => {
                if (err) {
                  console.log(err);
                  return;
                }
              });
            }
            
          }else{
            this.rootPath = "";
          }
        }else{
          this.rootPath = "";
        }

        

        // // 注册数据
        vscode.window.registerTreeDataProvider('redis-item', this.treeDataProvider);

        vscode.commands.registerCommand("redisExplorer.connectServer", item => {
            this.treeDataProvider.connectRedis(item);
        });

        vscode.commands.registerCommand("redisExplorer.readData", resource => {
            this.lastResource = resource;
            return this.openResource(resource);
        });
        
        vscode.commands.registerCommand('redisExplorer.refresh', () => {
          this.treeDataProvider.refresh();
        });

        vscode.commands.registerCommand('redisExplorer.refreshKey', async (element: Item)=> {
          let result = await this.treeDataProvider.getValue(element);
          let resource = {
            name: element.name,
            key: element.key,
            value: result,
            redisServer: element.redisServer,
            type: element.type
          };
          this.openResource(resource);
          this.treeDataProvider.refresh(element);
        });

        vscode.commands.registerCommand("redisExplorer.deleteKey",(element: Item) => {
            if (element) {
              this.treeDataProvider.deleteRedis(element);
              this.treeDataProvider.refresh();
            }
        });

        vscode.commands.registerCommand("redisExplorer.copyKeyName",(element: Item) => {
            if (element) {
              vscode.env.clipboard.writeText(element.key);
              vscode.window.showInformationMessage("key name is added to clipboard😘");
            }
        });

        vscode.commands.registerCommand("redisExplorer.command",async (element: Item) => {
          if (element) {
            const command = await vscode.window.showInputBox({
              prompt: "Input a redis command "
            });

            if (command === "" || command === undefined) {
              return;
            }

            this.treeDataProvider.execCommand(element,command).then(result => {
              vscode.window.showInformationMessage(`command result: ${result}`);
            }).catch(error => {
              vscode.window.showErrorMessage(`exec redis command error😢:${error}`);
            });
            this.treeDataProvider.refresh();
          }
      });

        vscode.commands.registerCommand("redisExplorer.addKey",async (element: Item) => {
            const key = await vscode.window.showInputBox({
              prompt: "Provide a new key "
            });

            const type = await vscode.window.showInputBox({
              prompt: "which type of key? string, hash etc"
            });
    
            if (key !== "" && type !== "") {
              this.lastResource = {name: "", key, value: type, redisServer: element.redisServer, type: ItemType.Item};
              fs.writeFile(
                `${this.rootPath}/${redisDummyFile}`,
                "",
                err => {
                  if (err) {
                    console.log(err);
                    return;
                  }
                  vscode.workspace
                    .openTextDocument(
                      `${this.rootPath}/${redisDummyFile}`
                    )
                    .then(doc => {
                      vscode.window.showTextDocument(doc);
                    });
                  vscode.window.showInformationMessage("you could input value and save file😁");
                }
              );
            }
          }
        );

        vscode.workspace.onDidChangeConfiguration(event => {
          this.treeDataProvider.reset();
          this.lastResource = undefined;
          this.treeDataProvider.refresh();
        });

        vscode.workspace.onDidSaveTextDocument(event => {
          const extension = event.fileName.split(".");
          if (extension[extension.length - 1] !== "redis") { return; }
          if (!this.lastResource.key) { return; }

          fs.readFile(event.fileName, (err, data) => {
            this.treeDataProvider.setRedisValue(this.lastResource,data.toString(),this.lastResource.value);
            this.treeDataProvider.refresh();
          });
        });
    }

    private openResource(resource: Item) {
      // key的值写入到临时文件中
      if(this.rootPath) {
        fs.writeFile(
            `${this.rootPath}/${redisDummyFile}`,
            typeof(resource.value) === "string"
              ? resource.value
              : JSON.stringify(resource.value, null, 2),
            err => {
              if (err) {
                console.log(err);
                return;
              }
              // 打开临时文件显示key的值
              vscode.workspace
                .openTextDocument(`${this.rootPath}/${redisDummyFile}`)
                .then(doc => {
                  vscode.window.showTextDocument(doc);
                });
            }
        );
      }else{
        vscode.window.showInformationMessage(`open a project first please😁,retry`);
      }
    }
}