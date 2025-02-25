// ==UserScript==
// @name       dy自动采集
// @namespace    http://tampermonkey.net/
// @version      2024-11-05
// @description  try to take over the world!
// @include        https://www.douyin.com/user/*
// ==/UserScript==

(function () {
    'use strict';

    const Aria2_save_folder = "G:/图文/douyin" // Aria2保存目录
    const Aria2_port = "6800" // JSON-RPC端口
    const Aria2_url = `http://localhost:${Aria2_port}/jsonrpc`; // JSON-RPC服务器地址
    let jump_time = getRandomInt(5, 20); // 队列采集时，跳转到下一个用户的时间，5-20秒，太快会导致作品链接未推送完成，也容易被拦截


    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    let fastNext = false;
    let justLive = false;
    let isBlockLastUserJump = true;
    let btn_list = [];
    let posts_list = [];
    let posts_map = new Map();
    //
    let g_count_el;
    let g_top_el;
    let g_time_select_el;
    let g_container_el;
    // 用来记录滚动的定时器
    let scroll_timer = null;
    // 每次滚动的步长累计
    let step_height = 0;
    // 作者信息
    let author_info = {};
    // 上次采集时间
    let last_time = 0;
    // 缓存到本地的localStorage名
    const storage_name = "col_list";
    // 用于判断是否还有数据未获取完毕，0已经获取完毕
    let has_more = 1;
    // 放在最后面的按钮组
    let after_btns_list;
    // 读取缓存，判断是否已经采集过
    let local_item = {};
    // 模态框的ID，可以用判断是否打开了单个作品，并展示单个作品下载按钮来采集单个作品
    let modalId = "";
    // 获取作品
    let check_seu_id_el = document.createElement("p");

    const Aria2_secret = ""; // Aria2密钥（如果设置了的话）

    let is_start = false;





    // ======================优先执行
    // 劫持的url
    const rep_url = "aweme/post"
    // 劫持 fetch 方法
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const [url, options] = args;
        // console.log('Fetch Request:', url, options);
        return originalFetch.apply(this, args)
            .then(response => {
                // console.info(`%c Fetch ${url}`,'color: blue; font-size: 16px;');
                if (url.indexOf(rep_url) > -1) {
                    // console.info(`%c 拦截到`,'color: blue; font-size: 16px;');
                    get_posts(response)
                }
                return response;
            })
            .catch(error => {
                throw error;
            });
    };

    // 劫持 XMLHttpRequest 方法
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this.addEventListener('load', function () {
            // console.info(`%c XHR ${url}`,'color: red; font-size: 16px;');
            if (url.indexOf(rep_url) > 1) {
                // console.info(`%c 拦截到`,'color: blue; font-size: 16px;');
                get_posts(this.responseText)
            }
        });
        originalOpen.call(this, method, url, async, user, password);
    };


    // ======================优先执行上面代码======================


    /* 工具函数 */
    // 将时间戳带格式的时间
    const format_time = (unixTimestamp) => {
        // 将Unix时间戳转换为毫秒
        const timestampInMilliseconds = unixTimestamp * 1000;

        // 创建Date对象
        const date = new Date(timestampInMilliseconds);

        // 获取年、月、日、小时和分钟
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，需要加1
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        // 组合成 datetime-local 格式的字符串
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // 日期转换
    const formatDateToYMDHMS = (date) => {
        const padZero = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2); // 获取年份的最后两位
        const month = padZero(date.getMonth() + 1); // 获取月份并确保是两位数
        const day = padZero(date.getDate()); // 获取日期并确保是两位数
        const hours = padZero(date.getHours()); // 获取小时并确保是两位数
        const minutes = padZero(date.getMinutes()); // 获取分钟并确保是两位数
        return `${year}${month}${day}_${hours}${minutes}`;
    }

    // 提取文件后缀
    const getFileExtension = (url) => {
        const urlParts = url.split('?')[0].split('.'); // 去掉查询参数并分割URL
        return urlParts[urlParts.length - 1]; // 返回最后一个部分作为文件后缀

    }

    // 过滤出中文字符串
    const filter_text = (text) => {
        try {
            let matchedChars = text.match(/[\u4e00-\u9fffA-Za-z]/g);
            return matchedChars ? matchedChars.join('') : '';
        } catch (e) {
            return ""
        }
    }

    let start_list_download = false;
    let count = 0;
    // 循环检测url变化
    const checkLocation = () => {
        setInterval(() => {
            (async () => {
                count += 1;

                let has_el = Array.from(document.querySelectorAll('div'))
                    .find(el => el.textContent.indexOf('私密账号') > -1);

                let err_el = Array.from(document.querySelectorAll('div'))
                    .find(el => el.textContent.indexOf('用户不存在') > -1);


                if (has_el || err_el) {
                    // page_func("next", true)
                    let users = handleLocalItem({ sign: "full" });
                    users.findIndex(item => {
                        if (location.href.includes(item.sec_uid)) {
                            console.log("用户不存在/私密账号", item)
                        }
                    })
                    return
                }
                if (document.querySelector("[data-e2e='user-tab-count']").innerHTML == '0' && location.href.indexOf("isList=true") > -1) {
                    return page_func("next", true)
                }
                if (!start_list_download) {
                    if (location.href.indexOf("isList=true") > -1) {
                        btn_list.forEach(item => {

                            if (!posts_list?.length && count >= 30) {
                                location.reload();
                            }
                            if (justLive) {
                                if (item.innerHTML == "采集全部live" && posts_list.length > 0) {
                                    start_list_download = true;
                                    auto_download = true;
                                    item.click();
                                }
                            } else {

                                if (item.innerHTML == "队列采集" && posts_list.length > 0) {
                                    start_list_download = true;
                                    auto_download = true;
                                    item.click();
                                }
                            }

                        })
                    }
                }

                const url = new URL(location.href);
                // 使用 URLSearchParams 解析查询字符串
                const searchParams = new URLSearchParams(url.search);

                // 提取 modal_id 参数
                modalId = searchParams.get('modal_id');
                posts_list.map(item => {
                    if (item.aweme_id == modalId) {
                        after_btns_list[0].innerHTML = `下载当前作品<br/>${format_time(item.create_time).replace("T", " ")}`
                    }
                })
                if (modalId) {

                    after_btns_list[0].style = "width:100%;padding:5px 0;border-radius:10px;display:block;background:green;color:white;margin-bottom:10px;";
                } else {
                    after_btns_list[0].style = "display:none";
                }
            })();
        }, 1000)
    }


    // 缓存本地数据
    const handleLocalItem = ({ sign, data }) => {

        let list = JSON.parse(localStorage.getItem(storage_name) || "[]");
        if (sign == "full") {
            return list;
        } else if (sign == 'set') {
            console.log("设置localStorage", data)
            // 存在则修改，不存在则添加
            let filter_item = list.filter(item => item.uid == data.uid);
            if (filter_item.length > 0) {
                console.log("本地已经存在item，修改")
                list = list.map(item => {
                    if (item.uid == data.uid) {
                        item = { ...data }
                    }
                    return item;
                });
            } else {
                console.log("本地不经存在item，增加")
                list.push(data)
            }
            localStorage.setItem(storage_name, JSON.stringify(list))
        } else {
            let filter_item = list.filter(item => item.uid == data.uid);
            return filter_item.length > 0 ? filter_item[0] : null;
        }
    }



    let auto_download_timer = null;
    let auto_download = false;
    const count_down = (sign) => {
        if (sign == 'now' && fastNext) return setTimeout(() => page_func("next", true), Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000);
        if (auto_download != true) return;
        clearInterval(auto_download_timer);
        let last_count = 0;
        auto_download_timer = setInterval(() => {
            (() => {
                last_count += 1;
                check_seu_id_el.innerHTML = `${last_count}`;
                if (last_count == jump_time) {
                    page_func("next", true)
                }
            })();
        }, 1000);
    }
    const download = (author, url, name, index, date, sign, img_index = "") => {
        is_start = true;
        return new Promise((resolve) => {
            let download_gap = 500
            setTimeout(async () => {
                date = formatDateToYMDHMS(new Date(date))
                name = `${date}-${name ? name.slice(0, 10) : ""}${img_index && "-" + img_index}.${sign == 'v' ? 'mp4' : getFileExtension(url)}`;
                // 示例：展示一条通知信息


                let requestBody = {
                    jsonrpc: "2.0",
                    method: "aria2.addUri",
                    id: `${name}`, // 请求 ID，可以是任意字符串
                    params: [
                        [url], // 下载链接列表
                        {
                            out: name,
                            //out:"hello.mp4",
                            dir: `${Aria2_save_folder}/${author}/`,
                            'header': [
                                `User-Agent: ${navigator.userAgent}`,
                                `Cookie: ${document.cookie}`,
                                `Referer: ${location.href}`
                            ]
                        }
                    ]
                };
                console.log(requestBody)
                requestBody = JSON.stringify(requestBody);
                try {
                    const response = await fetch(Aria2_url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: requestBody
                    });

                    if (!response.ok) {
                        throw new Error(`下载失败了: ${response.status}`);
                    }

                    const data = await response.json();
                    showNotification(`添加下载任务：${name}`, 5000);
                    is_start = false;
                    resolve(true)
                    return data;
                } catch (error) {
                    console.log("Aria2下载失败:", error);
                    showNotification(`添加下载任务失败：${name}`, 5000);
                    is_start = false;
                    resolve(false)
                } finally {
                    if (location.href.indexOf("isList") > -1) {
                        count_down();
                    }
                }
            }, download_gap * (index + 1))
        })
    }


    // 批量下载作品
    // cache: true的时候表示记录，false的时候表示缓存记录
    let big_last_time = 0;
    let temp_author_data = {
        uid: "",
        nickname: "",
        sec_uid: ""
    }
    const download_posts = (posts, cache) => {
        return new Promise(resolve => {
            // 找出数组中最后一个创建的内容


            // 去重
            posts.map(item => posts_map.set(item.aweme_id, item))
            posts = Array.from(posts_map).map(i => i[1])

            let promiseList = [];
            posts_list.map((item, index) => {
                if (location.href.includes(item.author.sec_uid)) {
                    temp_author_data.uid = item.author.uid;
                    temp_author_data.nickname = item.author.remark_name || item.author.nickname;
                    temp_author_data.sec_uid = item.author.sec_uid;
                }
            })

            posts.map(async (item, index) => {
                // 设置缓存，因为是异步的，有可能出现big_last_time >  item.create_time的情况
                if (item.create_time >= big_last_time) {
                    big_last_time = item.create_time


                }


                let d_name = filter_text(item.desc);
                let d_nickname = filter_text(temp_author_data.nickname) || filter_text(item.author.remark_name) || filter_text(item.author.nickname);
                let d_date = format_time(item.create_time);
                if (!d_nickname) {
                    const illegalChars = /[\\/:*?"<>|]/g;
                    // 使用 replace 方法替换非法字符为空字符串
                    d_nickname = item.author.nickname.replace(illegalChars, '');
                }


                if (item.images) {
                    item.images.map(async (img, img_index) => {
                        //live
                        if (img?.video && img?.video?.play_addr) {
                            let d_url = img?.video?.play_addr.url_list[0];
                            let res = await download(d_nickname, d_url, d_name, index, d_date, 'v', img_index)
                            promiseList.push(res)

                        } else {
                            if (justLive) return;
                            //图文
                            let d_url = img.url_list[img.url_list.length - 1];
                            // console.log("图片下载", d_name, img_index)
                            let res = await download(d_nickname, d_url, d_name, index, d_date, 'i', img_index)
                            promiseList.push(res)
                        }

                    })
                } else {
                    if (justLive) return;
                    //视频
                    let d_url = item.video.play_addr.url_list;
                    // console.log("视频下载", d_name)
                    let res = await download(d_nickname, d_url[0], d_name, index, d_date, 'v')
                    promiseList.push(res)
                }

            })
            Promise.all(promiseList).then(res => {
                console.log("页面下载完毕")
                g_time_select_el.value = format_time(big_last_time)


                try {
                    // 设置缓存
                    handleLocalItem({
                        sign: 'set',
                        data: {
                            // uid: item.author.uid,
                            // nickname: item.author.remark_name || item.author.nickname,
                            // create_time:big_last_time,
                            // sec_uid: item.author.sec_uid
                            ...temp_author_data,
                            create_time: big_last_time
                        }
                    })
                } catch { }


                scroll_timer = null;
                resolve(true)
            }).finally(() => {
                if (location.href.indexOf("isList") > -1 || justLive) {
                    count_down();
                }
            })
        })

    }


    let late_post_time = 0;
    function get_posts(response_text) {
        let cur_list = [];
        try {
            cur_list = JSON.parse(response_text).aweme_list;
            has_more = JSON.parse(response_text).has_more;
        } catch (e) {
            return console.log("转换出错aweme_list出错")
        }
        if (cur_list.length == 0) {
            return console.log("未获取到数据，终止后面执行")
        }
        posts_list = [...posts_list, ...cur_list]


        posts_list.map(async (item, index) => {
            if (item.create_time > late_post_time) {
                late_post_time = item.create_time;
            }
        });


        // 获取作品数量
        g_count_el.innerHTML = `已获取:${posts_list.length}`;
        g_top_el.innerHTML = `最新${format_time(late_post_time).replace("T", " ")}`;

        // 监听是否存在本地数据，判断有没有被采集过
        local_item = handleLocalItem({
            data: {
                uid: posts_list[0].author.uid
            }
        })
        if (local_item == null && posts_list[0]?.cooperation_info?.co_creators) {
            posts_list[0].cooperation_info?.co_creators.map(item => {
                if (location.href.includes(item.sec_uid)) {
                    let temp_data = handleLocalItem({
                        data: {
                            uid: item.uid
                        }
                    });
                    if (temp_data) {
                        local_item = temp_data;
                    }
                }

            })
        }




        if (local_item && g_container_el) {
            // if (!local_item?.sec_uid && check_seu_id_el.innerHTML.indexOf("sec_uid") == -1) {
            //   check_seu_id_el.style = "width:100%;color:#fff;";
            //   check_seu_id_el.innerHTML = "本地无sec_uid";
            //   g_container_el.appendChild(check_seu_id_el);
            // } else {
            //   check_seu_id_el.style = "width:100%;color:gray;";
            //   check_seu_id_el.innerHTML = "检测到sec_uid";
            //   g_container_el.appendChild(check_seu_id_el);
            // }
            // 如果有本地时间，且下拉列表未被选择
            if (!last_time) {
                g_time_select_el.value = format_time(local_item.create_time)
                last_time = local_item.create_time + 1000;
            }
        }

    }


    const after_btn0_func = () => {
        posts_list.map(item => {
            if (item.aweme_id == modalId) {

                let d_name = filter_text(item.desc);
                let d_nickname = filter_text(item.author.remark_name || item.author.nickname);
                let d_date = format_time(item.create_time);


                if (item.images) {
                    //图文
                    item.images.map((img, img_index) => {
                        let d_url = img.url_list[img.url_list.length - 1];
                        download(d_nickname, d_url, d_name, "", d_date, img_index)
                    })


                } else {
                    //视频
                    let d_url = item.video.play_addr.url_list;
                    download(d_nickname, d_url[0], d_name, "", d_date, 'v')
                }
            }
        })

    }

    // 全部采集：global_btns_text[0]执行滚动即可
    const btn1_func = () => {
        if (is_start) return;
        if (posts_list.length <= 0) return showNotification("未检测到作品，请刷新尝试");
        // 自动开始滚动
        if (scroll_timer) return console.log("点击无效，数据还在获取中");
        scroll_timer = setInterval(() => {
            // 滚动
            step_height += 800;
            document.querySelector(".parent-route-container").scrollTo(0, step_height);
            // 判断数据是后已经获取完毕
            (async function () {
                // has_more是0的时候表示已经获取完毕了
                let has_el = Array.from(document.querySelectorAll('div'))
                    .find(el => el.textContent === '暂时没有更多了');
                if (has_el || (`${has_more}` == "0")) {
                    // 获取完毕先暂停滚动，等到下载完毕才重置timer
                    clearInterval(scroll_timer);
                    await download_posts(posts_list, true);
                }
            })();
        }, 1000)
    }

    // 全部采集：不设置缓存
    const btn2_func = () => {
        if (is_start) return;
        if (posts_list.length <= 0) return showNotification("未检测到作品，请刷新尝试");
        // 自动开始滚动
        if (scroll_timer) return console.log("点击无效，数据还在获取中");
        scroll_timer = setInterval(() => {
            // 滚动
            step_height += 500;
            document.querySelector(".parent-route-container").scrollTo(0, step_height);
            // 判断数据是后已经获取完毕
            (async function () {
                // has_more是0的时候表示已经获取完毕了
                let has_el = Array.from(document.querySelectorAll('div'))
                    .find(el => el.textContent === '暂时没有更多了');
                if (has_el || has_more == 0) {
                    // 获取完毕先暂停滚动，等到下载完毕才重置timer
                    clearInterval(scroll_timer);
                    await download_posts(posts_list, false);
                }
            })();
        }, 1000)
    }

    // 根据时间部分采集
    let temp_download_arr = [];
    const btn3_func = (autoDw) => {
        if (is_start) return;
        if (posts_list.length <= 0) return showNotification("未检测到作品，请刷新尝试");
        // 如果没有填写时间值则
        if (!g_time_select_el.value) {
            // return btn1_func();
            return showNotification("请设置时间值")
        }
        // 自动开始滚动
        if (scroll_timer) return console.log("点击无效，数据还在获取中");

        return new Promise(resolve => {
            scroll_timer = setInterval(() => {
                // 滚动
                step_height += 500;
                document.querySelector(".parent-route-container").scrollTo(0, step_height);

                // 判断数据是后已经获取完毕
                (async function () {

                    let has_el = Array.from(document.querySelectorAll('div'))
                        .find(el => el.textContent === '暂时没有更多了');

                    if (has_el) {
                        has_more = "0";
                        clearInterval(scroll_timer);
                        scroll_timer = null;
                    }

                    // 已经获取到比设置时间小的内容，暂停计时器
                    posts_list.map(item => {
                        if (item.create_time < last_time) {
                            // 时间少于设置时间且非置顶的作品，直接暂停滚动
                            if (item.is_top == 0 || `${has_more}` == "0") {
                                clearInterval(scroll_timer);
                                scroll_timer = null;
                            }
                        } else {
                            temp_download_arr.push(item)
                        }
                    })

                    // 获取完毕，开始采集
                    if (scroll_timer == null) {
                        if (!temp_download_arr.length) {

                            // handleLocalItem({
                            //     sign: 'set', data: {
                            //         uid: posts_list[0].author.uid,
                            //         nickname: posts_list[0].author.nickname,
                            //         create_time: last_time,
                            //         sec_uid: posts_list[0].author.sec_uid
                            //     }
                            // });
                            showNotification("未检测到新数据");
                            if (auto_download) {
                                count_down("now")
                            }
                            resolve(true);

                        } else {
                            // 获取完毕先暂停滚动，等到下载完毕才重置timer
                            await download_posts(temp_download_arr, true)
                            g_time_select_el.value = format_time(last_time);
                            resolve(true)
                        }
                    }
                })();
            }, 1000)
        })
    }


    const btn4_func = () => {
        if (is_start) return;
        if (posts_list.length <= 0) return showNotification("未检测到作品，请刷新尝试");
        if (!local_item) {
            return showNotification("该用户不在队列中无法进行该操作")
        }
        const url = new URL(location.href);
        url.searchParams.append('hello', 'world');
        location.replace(url)
    }

    const page_func = (sign, isList = false) => {
        let users = handleLocalItem({ sign: "full" });
        // const uid = posts_list[0]?.author?.uid;
        // let index = users.findIndex(item => item.uid == uid);
        let index = users.findIndex(item => {
            return location.href.includes(item.sec_uid)
        })
        if (index == -1 && sign != 'zero') {
            return alert("队列中未找到下一个用户")
        }


        let user;
        if (sign == "prev") {
            index = index - 1 < 0 ? users.length - 1 : index - 1;
            console.log("上一个用户", users[index])
            user = users[index]

        } else if (sign == 'next') {
            if (isList && index + 1 >= users.length && isBlockLastUserJump) {
                // 自动下载时，最后一个用户时拦截跳转
                return alert("本次采集完毕")
            }
            index = index + 1 >= users.length ? 0 : index + 1;
            console.log("下一个用户", users[index])
            user = users[index]
        } else if (sign == 'zero') {
            user = users[0]
        }
        if (isList) {
            location.href = `https://www.douyin.com/user/${user.sec_uid}?isList=true&index=${index}.${users.length}`;
        } else {
            location.href = `https://www.douyin.com/user/${user.sec_uid}`;
        }

    }

    const remove_this = () => {
        let users = handleLocalItem({ sign: "full" });
        const uid = posts_list[0]?.author?.uid;
        let index = users.findIndex(item => item.uid == uid);
        if (index == -1) {
            index = users.findIndex(item => {
                return location.href.includes(item.sec_uid)
            })
        }

        if (index > -1) {
            let res = confirm("确定移除此用户吗？")
            if (res) {
                let next_index = index - 1 < 0 ? 0 : index - 1;
                let next_sec_uid = users[next_index].sec_uid;
                users[index] = null;
                localStorage.setItem(storage_name, JSON.stringify(users.filter(item => item)))
                location.href = `https://www.douyin.com/user/${next_sec_uid}`;
            }
        }
    }

    const handler_config = (sign) => {
        let users = handleLocalItem({ sign: "full" });
        if (sign == "export") {
            prompt("", JSON.stringify(users))
        }
    }

    // 初始化dom
    const init_dom = () => {
        // 创建容器
        g_container_el = document.createElement("div")
        g_container_el.setAttribute("class", "btn-container")
        Object.assign(g_container_el.style, {
            width: 'fit-content',
            height: "fit-content",
            padding: '10px',
            background: '#1e90ff',
            position: 'fixed',
            left: '10px',
            bottom: '10px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        })

        // 添加拖拽功能
        let isDragging = false;
        let offsetX, offsetY;

        g_container_el.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - g_container_el.offsetLeft;
            offsetY = e.clientY - g_container_el.offsetTop;
            g_container_el.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const x = e.clientX - offsetX;
                const y = e.clientY - offsetY;

                // 限制在窗口范围内
                const maxX = window.innerWidth - g_container_el.offsetWidth;
                const maxY = window.innerHeight - g_container_el.offsetHeight;

                g_container_el.style.left = `${Math.min(Math.max(0, x), maxX)}px`;
                g_container_el.style.top = `${Math.min(Math.max(0, y), maxY)}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                g_container_el.style.cursor = 'move';
            }
        });

        document.body.appendChild(g_container_el)


        // 计数
        g_count_el = document.createElement("div");
        g_count_el.style = "width:100%;color:#ffffff;font-weight:bold;margin-bottom:10px;"
        g_count_el.title = ""

        g_top_el = document.createElement("div");
        g_top_el.style = "width:100%;color:#ffffff;font-weight:bold;margin-bottom:10px;font-size:12px;"
        g_top_el.title = ""
        g_container_el.append(g_count_el, g_top_el)



        // 放在前面的按钮组
        btn_list = ["全部采集", "全部采集不设缓存", '移除此用户', "队列采集", "根据时间采集", "采集全部live"].map(item => {
            let btn = document.createElement("button");
            btn.innerHTML = item;
            btn.style = "width:100%;height:30px;border-radius:10px;margin-bottom:10px;";
            g_container_el.appendChild(btn)
            return btn;
        })

        // 根据时间采集的选择
        g_time_select_el = document.createElement("input");
        g_time_select_el.type = "datetime-local"
        g_time_select_el.placeholder = "最后采集时间"
        g_time_select_el.title = "会根据该时间采集到最新的内容，格式: 2024/1-1"
        g_time_select_el.style = "background: white; color: black;height:20px;width:100%;display:block;margin-bottom:10px;"
        g_container_el.appendChild(g_time_select_el)
        g_time_select_el.addEventListener("change", (e) => {
            last_time = Math.floor(new Date(e.target.value).getTime() / 1000);
        })
        g_time_select_el.addEventListener("click", (e) => {
            e.target.showPicker();
        })

        // 放在最后的按钮组
        after_btns_list = ["下载当前作品"].map((item, index) => {
            let btn = document.createElement("button");
            btn.innerHTML = item;
            btn.style = "display:none;margin-top:10px";
            g_container_el.appendChild(btn)
            return btn;
        })

        // 添加翻页按钮
        const pageControls = document.createElement('div');
        pageControls.style = "display: flex; gap: 8px; margin-top: 10px;";

        const prevBtn = document.createElement('button');
        prevBtn.innerHTML = '上一个';
        prevBtn.style = "width:fit-content;padding: 6px; border-radius: 4px; background: #fff; color: #1e90ff;";
        // prevBtn.addEventListener('click', () => page_func('prev'));

        const zeroBtn = document.createElement('button');
        zeroBtn.innerHTML = '首个';
        zeroBtn.style = "width:fit-content; padding: 6px; border-radius: 4px; background: #fff; color: #1e90ff;";
        // zeroBtn.addEventListener('click', () => page_func('prev'));

        const nextBtn = document.createElement('button');
        nextBtn.innerHTML = '下一个';
        nextBtn.style = "width:fit-content; padding: 6px; border-radius: 4px; background: #fff; color: #1e90ff;";
        // nextBtn.addEventListener('click', () => page_func('next'));

        pageControls.appendChild(prevBtn);
        pageControls.appendChild(zeroBtn);
        pageControls.appendChild(nextBtn);
        g_container_el.appendChild(pageControls);

        //         // 导入导出按钮
        //         const exportControls = document.createElement('div');
        //         exportControls.style = "display: flex; gap: 8px; margin-top: 10px;justify-content:center;";

        //         const importBtn = document.createElement('button');
        //         importBtn.innerHTML = '导入';
        //         importBtn.style = "width:fit-content; padding: 6px; border-radius: 4px; background: #fff; color: #1e90ff;";

        //         const exportBtn = document.createElement('button');
        //         exportBtn.innerHTML = '导出';
        //         exportBtn.style = "width:fit-content; padding: 6px; border-radius: 4px; background: #fff; color: #1e90ff;";

        //         exportControls.append(importBtn,exportBtn);
        //         g_container_el.appendChild(exportControls);



        g_container_el.appendChild(check_seu_id_el)

        // 绑定按键
        g_container_el.addEventListener("click", async (e) => {
            if (e.target.innerHTML == '全部采集') {
                e.target.title = "会进行滚动获取最新数据，然后采集全部作品"
                btn1_func();
            } else if (e.target.innerHTML == '全部采集不设缓存') {
                e.target.title = "会按照最后的采集时间采集到最新的作品";
                btn2_func();
            } else if (e.target.innerHTML == '根据时间采集') {
                e.target.title = "采集全部作品，但不会记录信息"
                btn3_func()
            } else if (e.target.innerHTML == '队列采集') {
                e.target.title = "按照localStorage列表自动采集"
                auto_download = true;
                await btn3_func();

            } else if (e.target.innerHTML.indexOf("下载当前作品") > -1) {
                e.target.title = "下载当前作品"
                after_btn0_func()
            } else if (e.target.innerHTML == "上一个") {
                page_func("prev")
            } else if (e.target.innerHTML == "下一个") {
                page_func("next")
            } else if (e.target.innerHTML == "首个") {
                page_func("zero")
            } else if (e.target.innerHTML == "移除此用户") {
                remove_this()
            } else if (e.target.innerHTML == "导入") {
                handler_config("import")
            } else if (e.target.innerHTML == "导出") {
                handler_config("export")
            } else if (e.target.innerHTML == "采集全部live") {
                auto_download = true;
                await btn1_func();
            }
        })
    }



    // 初始化dom
    if (location.href.indexOf("douyin.com/user") > -1 && location.href.indexOf("self") == -1) {
        init_dom();
        checkLocation()
    }


    function createNotificationElement() {
        // 创建 div 元素作为通知框
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.padding = '15px';
        notification.style.backgroundColor = 'green'; // 红色背景
        notification.style.color = 'white';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        notification.style.zIndex = '1000';
        notification.style.display = 'none'; // 默认隐藏
        notification.style.items = "center";

        // 创建 span 元素用于显示消息内容
        const messageElement = document.createElement('span');
        messageElement.id = 'message';

        // 创建关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.id = 'closeNotification';
        closeBtn.textContent = 'x';
        closeBtn.style = "cursor:pointer;margin-left:20px;float:right;"
        // 将子元素添加到通知框中
        notification.appendChild(messageElement);
        notification.appendChild(closeBtn);

        // 添加关闭按钮点击事件监听器
        closeBtn.addEventListener('click', () => hideNotification(notification));

        // 将通知框添加到文档中
        document.body.appendChild(notification);

        return notification;
    }

    // 显示通知框
    function showNotification(message, duration = 3000) {
        const notification = document.getElementById('notification') || createNotificationElement();
        const messageElement = notification.querySelector('#message');

        // 设置消息内容
        messageElement.textContent = message;

        // 显示通知框
        notification.style.display = 'flex';

        // 如果设置了持续时间，则在指定的时间后自动隐藏通知框
        if (duration > 0) {
            setTimeout(() => hideNotification(notification), duration);
        }
    }

    // 隐藏通知框
    function hideNotification(notification) {
        notification.style.display = 'none';
    }
    console.log("本项目由@JeremyRu开发，欢迎star，项目地址：https://github.com/jeremyru/dy_collection")
})();
