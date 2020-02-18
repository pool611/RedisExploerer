// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { RedisExplorer } from "./RedisExplorer";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "redisexplorer" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand("redisExplorer.redisServer", async () => {
		const name = await vscode.window.showInputBox({
		  prompt: "input your redis name which you like please😊",
		  ignoreFocusOut: true
		});
  
		if (name === ""|| name === undefined) {
		  vscode.window.showInformationMessage(
			"input your correct redis name please😅"
		  );
		  return;
		}

		const address = await vscode.window.showInputBox({
			prompt: "input your redis address please😊",
			ignoreFocusOut: true
		});

		if (address === "" || address === undefined) {
			vscode.window.showInformationMessage(
				"input your correct redis address please😅"
			);
			return;
		}

		const password = await vscode.window.showInputBox({
		  prompt: "input your redis password(if need)😂",
		  ignoreFocusOut: true
		});

		if (password === undefined) {
			vscode.window.showErrorMessage(
				"something wrong with password input😅"
			);
			return;
		}
  
		// for myRedis.list
		const configuration = vscode.workspace.getConfiguration();
		const lastList: string = (configuration.myRedis && configuration.myRedis.list) ? configuration.myRedis.list : "";
		const lastListArray: string[] = lastList.split(';');
		const nameIndex = lastListArray.findIndex(item => item === name);

		// for myRedis.address  
		const lastAddress: string = (configuration.myRedis && configuration.myRedis.address) ? configuration.myRedis.address : "";
		const lastAddressArray: string[]  = lastAddress.split(';');
		let newAddress;
		if (lastAddress === "") {
			newAddress = address;
		}else if (nameIndex === -1){
			newAddress = lastAddress + ";" + address;
		}else {
			lastAddressArray[nameIndex] = address;
			newAddress = lastAddressArray.join(";");
		}
		
		// for myRedis.password  
		const lastPassword: string = (configuration.myRedis && configuration.myRedis.password) ? configuration.myRedis.password : "";
		const lastPasswordArray: string[]  = lastPassword.split(';');
		let newPassword;
		if (lastPassword === "" && lastList === "") {
			newPassword = password;
		}else if (nameIndex === -1){
			newPassword = lastPassword + ";" + password;
		}else {
			lastPasswordArray[nameIndex] = password;
			newPassword = lastPasswordArray.join(";");
		}

		await vscode.workspace
		  .getConfiguration()
		  .update(
			"myRedis.list",
			lastList === "" ? name : (nameIndex === -1 ? (lastList + ';' + name) : lastList),
			vscode.ConfigurationTarget.Global
		);

		await vscode.workspace
		  .getConfiguration()
		  .update(
			`myRedis.address`,
			newAddress,
			vscode.ConfigurationTarget.Global
		);

		await vscode.workspace
		  .getConfiguration()
		  .update(
			`myRedis.password`,
			newPassword,
			vscode.ConfigurationTarget.Global
		  );
	  }));

	// tslint:disable-next-line: no-unused-expression
	new RedisExplorer(context);
}

// this method is called when your extension is deactivated
export function deactivate() {}
