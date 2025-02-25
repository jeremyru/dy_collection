# 抖音自动采集脚本

> 这是一个用于自动采集抖音用户主页作品的浏览器脚本，通过 Tampermonkey 插件在浏览器中运行。支持采集单个、批量、队列采集。

## 功能

-   全部采集：自动滚动页面并采集用户的所有作品
-   单个采集：打开用户主页，然后点击作品即可看到
-   队列采集：按照用户的添加顺序队列自动采集作品，可到 localStorage 中查看
-   根据时间采集：通过最下方的 time 输入框选择时间，自动采集该时间之的作品
-   缓存支持：将用户信息缓存到浏览器本地，可以通过 storage_name 自定义缓存名称，全部采集或者根据时间采集时，会自动缓存用户信息
-   下载方式：本项目使用 Aria2 进行下载，您可以根据需要修改脚本中的配置，如 Aria2 服务器地址、端口、保存目录等，本人使用的是 Motrix，端口是 6800，如果需要修改可以自行到 Motrix 进阶设置中修改"RPC 监听端口"，还有到脚本中修改 Aria2_port
-   保存目录 Aria2_save_folder：目录直接填写文件夹路径，如"G:/图文/douyin"，目录使用/分割，并且最后不要带/。写错了无所谓，顶多就下载的目录不对，不会影响程序运行。

## 使用方法

1.  安装 [motrix](https://motrix.app/)，主要用于推送下载地址
2.  安装浏览器插件 [Tampermonkey(篡改猴)](https://microsoftedge.microsoft.com/addons/detail/%E7%AF%A1%E6%94%B9%E7%8C%B4/iikmkjmpaadaobahmlepeloendndfphd?hl=zh-CN)，用于运行脚本
3.  到 Tampermonkey 中添加新脚本，将脚本代码(本项目中的 dy.js)复制粘贴到脚本中
4.  随便打开一个作者主页，点击脚本中的采集按钮，即可开始采集作品

## 注意事项

-   运行脚本前，请确保 Aria2 服务器正在运行，并且可以接收来自脚本的下载请求。
-   未获取到作品数量的时候请手动刷新，如果是队列采集则会自动刷新

## 其它

-   本项目仅供学习和研究使用，请勿用于商业用途。
-   本项目中的脚本代码仅供参考，不保证其正确性和安全性，请根据您的需求自行修改。
-   如果您有任何建议或问题，请随时提交 issue 或 pull request。

## 捐赠

作者快揭不开锅了，一分也是爱，感谢支持！
![支付宝](./images/alipay.jpg){height="300px"}
![微信](./images/wechat-pay.jpg){height="300px"}
