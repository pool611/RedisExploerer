# redisexplorer | redis浏览器

Redis Explorer show all keys in treeView. you can add key, delete key, modify key.

---
redis浏览器，可以查看redis的所有key，支持添加key，删除key，修改key的操作。使用scan遍历所有key，不会造成阻塞。

## Note | 注意

To access to Redis Server from UI.

Add .vscode/.myRedis.redis file to .gitignore

---
通过UI访问redis服务器

添加.vscode/.myRedis.redis文件到.gitignore中，.myRedis.redis为读取redis中key值的临时文件

## Usage | 用例

* add redis address, port, and password(if need)
---
* 添加redis地址，端口，密码（如果redis需要密码）

![avatar](/media/readme/addAddress.gif)

* add key

redis address example: 127.0.0.1:6379

redis cluster address example: 127.0.0.1:6379,127.0.0.1:6380,127.0.0.1:6381,127.0.0.1:6382

---
* 添加redis key

redis地址示例: 127.0.0.1:6379

redis集群地址示例: 127.0.0.1:6379,127.0.0.1:6380,127.0.0.1:6381,127.0.0.1:6382

![avatar](/media/readme/addKey.gif)

* modify key and delete key
---
* 修改key 删除key

![avatar](/media/readme/modifyKeyAndDeleteKey.gif)

* exec redis command
---
* 执行redis命令

![avatar](/media/readme/execCommand.gif)

## Requirements | 必要条件

It needs to know rootpath, so please open a project(any project) first

---
扩展需要知道项目根目录，用来创建.vscode/.myRedis.redis文件，所以使用扩展之前请先打开一个项目

## Extension Settings | 扩展设置

This extension contributes the following settings:

* `myRedis.list`: redis name, you know which redis it is
* `myRedis.address`: redis address, if it is cluter, it have more IP and port
* `myRedis.password`: redis password if have

---

这个扩展有以下一些设置：

* `myRedis.list`: redis名称，用于使用哪个redis
* `myRedis.address`: redis地址，若是集群，请一次性填写更多的地址
* `myRedis.password`: redis密码，若需要的话

## Known Issues | 已知的问题

Modify key: it do not modify menber, it will delete key, then add the same key with new value.

---
修改key： 该扩展无法修改例如list，hash，set，zset中的单一值，修改的操作实际是删除key，然后重新添加同名key，附带最新的值

## Thanks | 感谢

>I learn his/her code and code this redisExpoloer with cluster support
---
>我从他(她)的redis扩展中学习代码，并写了这个支持集群连接的扩展

youngki