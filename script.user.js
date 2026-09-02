// ==UserScript==
// @name         小红书自动化抽奖助手
// @namespace    https://automation.local/
// @version      1.0.0
// @description  抽奖自动化
// @match        https://www.xiaohongshu.com/
// @match        https://www.xiaohongshu.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant unsafeWindow
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'automation_task_data';
    const pageWindow = unsafeWindow;
    const CONFIG = {

        selectors: {

            // 搜索输入框
            textarea: '.textarea',

            // 搜索结果出现后点击的元素
            readyElement: '.xhs-ai-selected-note-card',

            // 点赞
            like: '.left .like-wrapper.like-active',

            // 收藏
            favorite: '.collect-wrapper',

            // 评论按钮
            commentButton: '.chat-wrapper',

            // 评论输入框
            commentInput: '#content-textarea',

            // 评论发送
            commentSend: 'button.btn.submit',

            // 关注按钮
            follow: 'button.follow-button',

            // 第一个关闭按钮
            close1: '.close.close-mask-dark',

            // 第二个关闭按钮
            close2: '.xhs-ai-selected-note-remove'
        },

        // 预设评论
        comment: '许愿许愿许愿，我真的好想要这个呀',

        // 每个动作之间等待
        actionDelay: 700,

        // 等待元素最长时间
        elementTimeout: 10000,

        // 关闭按钮之间等待
        closeDelay: 500
    };


    // 模拟鼠标点击元素
    // 模拟真实鼠标点击
    function simulateMouseClick(element) {
        const rect =
              element.getBoundingClientRect();

        const options = {
            bubbles: true,
            cancelable: true,
            clientX:
            rect.left + rect.width / 2,
            clientY:
            rect.top + rect.height / 2,
            button: 0
        };

        element.dispatchEvent(
            new MouseEvent(
                'mousedown',
                options
            )
        );

        element.dispatchEvent(
            new MouseEvent(
                'mouseup',
                options
            )
        );

        element.dispatchEvent(
            new MouseEvent(
                'click',
                options
            )
        );
    }
    let processing = false;

    let runningTaskId = null;

    // 获取持久化数据
    function getData() {
        const data = GM_getValue(
            STORAGE_KEY,
            null
        );

        if (!data) {
            return {
                pending: [],
                processed: [],
                currentTask: null,
                logs: []
            };
        }

        return data;
    }

    // 保存持久化数据
    function saveData(data) {
        GM_setValue(
            STORAGE_KEY,
            data
        );
    }

    // 创建任务
    function createTask(value) {
        return {
            id:
            `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}`,

            value: value,

            status: 'pending',

            step: 'textarea',

            createdAt: Date.now(),

            processedAt: null,

            error: null
        };
    }

    // 添加任务
    function addTasks(text) {
        const data = getData();

        const values = text
        .split(/\r?\n/)
        .map(x => x.trim())
        .filter(Boolean);

        let count = 0;

        for (const value of values) {

            const exists =
                  data.pending.some(
                      x => x.value === value
                  ) ||
                  data.processed.some(
                      x => x.value === value
                  ) ||
                  (
                      data.currentTask &&
                      data.currentTask.value === value
                  );

            if (exists) {
                addLog(
                    `重复任务：${value}`,
                    'warning'
                );

                continue;
            }

            data.pending.push(
                createTask(value)
            );

            count++;
        }

        saveData(data);

        addLog(
            `添加 ${count} 个任务`,
            'info'
        );

        render();
    }

    // 添加日志
    function addLog(
    message,
     level = 'info'
    ) {
        const data = getData();

        data.logs.unshift({
            time:
            new Date()
            .toLocaleString(),

            level: level,

            message: message
        });

        if (data.logs.length > 500) {
            data.logs.length = 500;
        }

        saveData(data);

        renderLogs();
    }

    // 开始处理
    function startProcessing() {
        if (processing) {
            addLog(
                '任务已经在处理中',
                'warning'
            );

            return;
        }

        processing = true;

        addLog(
            '开始处理任务',
            'info'
        );

        processNextTask();
    }

    // 停止处理
    function stopProcessing() {
        processing = false;

        addLog(
            '已停止自动处理',
            'warning'
        );

        render();
    }

    // 处理下一个任务
    function processNextTask() {
        if (!processing) {
            return;
        }

        const data = getData();

        if (data.currentTask) {
            runningTaskId =
                data.currentTask.id;

            processCurrentTask(
                data.currentTask
            );

            return;
        }

        if (data.pending.length === 0) {
            processing = false;

            runningTaskId = null;

            addLog(
                '所有任务处理完成',
                'info'
            );

            render();

            return;
        }

        const task =
              data.pending.shift();

        task.status = 'processing';

        task.step = 'textarea';

        task.error = null;

        data.currentTask = task;

        saveData(data);

        runningTaskId = task.id;

        addLog(
            `开始处理：${task.value}`,
            'info'
        );

        render();

        processCurrentTask(task);
    }

    // 处理当前任务
    function processCurrentTask(task) {
        if (!processing) {
            return;
        }

        if (
            runningTaskId &&
            runningTaskId !== task.id
        ) {
            return;
        }

        runTask(task)
            .catch(error => {
            failTask(
                task,
                error
            );
        });
    }

    // 执行任务流程
    async function runTask(task) {

        if (!processing) {
            return;
        }

        if (
            task.step === 'textarea'
        ) {
            await executeStep(
                task,
                'ready',
                fillTextarea
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'ready'
        ) {
            await executeStep(
                task,
                'like',
                clickReadyElement
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'like'
        ) {
            await executeStep(
                task,
                'favorite',
                handleLike
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'favorite'
        ) {
            await executeStep(
                task,
                'comment',
                handleFavorite
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'comment'
        ) {
            await executeStep(
                task,
                'follow',
                handleComment
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'follow'
        ) {
            await executeStep(
                task,
                'close1',
                handleFollow
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'close1'
        ) {
            await executeStep(
                task,
                'close2',
                handleClose1
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'close2'
        ) {
            await executeStep(
                task,
                'completed',
                handleClose2
            );
        }

        if (!processing) {
            return;
        }

        if (
            task.step === 'completed'
        ) {
            finishTask(task);
        }
    }

    // 执行任务步骤
    async function executeStep(
    task,
     nextStep,
     action
    ) {
        if (!processing) {
            return;
        }

        task.step = nextStep;

        saveCurrentTask(task);

        addLog(
            `${getStepName(nextStep)}：${task.value}`,
            'info'
        );

        await action();

        if (!processing) {
            return;
        }

        saveCurrentTask(task);

        await sleep(
            CONFIG.actionDelay
        );
    }

    // 获取步骤名称
    function getStepName(step) {
        const names = {
            textarea: '输入内容',
            ready: '等待元素',
            like: '点赞',
            favorite: '收藏',
            comment: '评论',
            follow: '关注',
            close1: '关闭窗口 1',
            close2: '关闭窗口 2',
            completed: '完成'
        };

        return names[step] || step;
    }

    // 填写 textarea
    async function fillTextarea() {
        const textarea =
              await waitForElement(
                  CONFIG.selectors.textarea
              );

        const data = getData();

        if (!data.currentTask) {
            throw new Error(
                '当前任务不存在'
            );
        }

        simulatePaste(
            textarea,
            data.currentTask.value
        );
    }

    // 模拟粘贴
    function simulatePaste(
    element,
     value
    ) {
        element.focus();

        try {
            const dataTransfer =
                  new DataTransfer();

            dataTransfer.setData(
                'text/plain',
                value
            );

            const event =
                  new ClipboardEvent(
                      'paste',
                      {
                          bubbles: true,
                          cancelable: true,
                          clipboardData:
                          dataTransfer
                      }
                  );

            element.dispatchEvent(
                event
            );
        } catch {
        }

        if (
            element instanceof
            HTMLInputElement ||
            element instanceof
            HTMLTextAreaElement
        ) {
            const setter =
                  Object.getOwnPropertyDescriptor(
                      HTMLTextAreaElement.prototype,
                      'value'
                  )?.set ||
                  Object.getOwnPropertyDescriptor(
                      HTMLInputElement.prototype,
                      'value'
                  )?.set;

            if (setter) {
                setter.call(
                    element,
                    value
                );
            } else {
                element.value = value;
            }
        } else {
            element.textContent =
                value;
        }

        element.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    inputType:
                    'insertText',
                    data: value
                }
            )
        );

        element.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );
    }

    // 点击等待元素
    async function clickReadyElement() {
        const element =
              await waitForElement(
                  CONFIG.selectors.readyElement
              );

        element.click();
    }// 在页面上下文执行代码
    function executeInPageContext(code) {
        const script = document.createElement('script');

        script.textContent = `
        (() => {
         const event =
        new MouseEvent(
            'click',
            {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: document.defaultView,
                detail: 1,
                button: 0,
                buttons: 1
            }
        );

    event._vts = Date.now();
    ${code}
    element.dispatchEvent(event);

        })();
    `;

    document.documentElement.appendChild(script);

    script.remove();
}
    function triggerClick(element) {
        const event =
              new MouseEvent(
                  'click',
                  {
                      bubbles: true,
                      cancelable: true,
                      composed: true,
                      view: document.defaultView,
                      detail: 1,
                      button: 0,
                      buttons: 1
                  }
              );

        event._vts = Date.now();

        element.dispatchEvent(event);
    }
    // 处理点赞
    async function handleLike() {
        const button =
              await waitForElement(
                  CONFIG.selectors.like
              );

        const use =
              button.querySelector('use');

        if (!use) {
            throw new Error(
                '点赞按钮中没有找到 use 元素'
            );
        }

        const href =
              use.getAttribute('href')
        // use.getAttribute('xlink:href') ||
        '';
        addLog(href);
        if (href.endsWith('/web-static/svg-sprite.6.46.1.svg#liked')) {
            addLog(
                '已经点赞，跳过',
                'info'
            );

            return;
        }

        if (
            href === '#like' ||
            href.endsWith('#like')
        ) {

            const element =
                  document.querySelector(
                      CONFIG.selectors.like
                  );

            console.log(
                '[测试] like元素：',
                element
            );

            if (!element) {
                console.log(
                    '[测试] 找不到like按钮'
                );
                return;
            }

            console.log(
                '[测试] click 类型：',
                typeof element.click
            );

            element.click();



            addLog(
                '执行点赞',
                'info'
            );

            return;
        }

        throw new Error(
            `未知点赞状态：${href}`
    );
}

    // 处理收藏
    async function handleFavorite() {
        const button =
              await waitForElement(
                  CONFIG.selectors.favorite
              );

        const use =
              button.querySelector('use');

        if (!use) {
            throw new Error(
                '收藏按钮中没有找到 use 元素'
            );
        }

        const href =
              use.getAttribute('href') ||
              use.getAttribute('xlink:href') ||
              '';

        if (href.endsWith('#collected')) {
            addLog(
                '已经收藏，跳过',
                'info'
            );

            return;
        }

        if (
            href === '#collect' ||
            href.endsWith('#collect')
        ) {
            const element =
                  document.querySelector(
                      CONFIG.selectors.favorite
                  );

            addLog(
                '[测试] favorite元素：',
                element
            );

            if (!element) {
                addLog(
                    '[测试] 找不到favorite按钮'
                );
                return;
            }

            addLog(
                '[测试] click 类型：',
                typeof element.click
            );

            element.click();
            addLog(
                '执行收藏',
                'info'
            );

            return;
        }

        throw new Error(
            `未知收藏状态：${href}`
    );
}

    // 处理评论
    async function handleComment() {
        const button =
              await waitForElement(
                  CONFIG.selectors.commentButton
              );


        const element =
              document.querySelector(
                  CONFIG.selectors.commentButton
              );

        console.log(
            '[测试] 评论元素：',
            element
        );

        if (!element) {
            console.log(
                '[测试] 找不到评论按钮'
            );
            return;
        }

        console.log(
            '[测试] click 类型：',
            typeof element.click
        );

        element.click();
        addLog(
            '打开评论输入框',
            'info'
        );

        const input =
              await waitForElement(
                  CONFIG.selectors.commentInput
              );

        simulateContentEditableInput(
            input,
            CONFIG.comment
        );

        await sleep(
            CONFIG.actionDelay
        );

        const send =
              await waitForElement(
                  CONFIG.selectors.commentSend
              );

        // document.querySelector(CONFIG.selectors.commentSend).click();
        const element1 =
              document.querySelector(
                  CONFIG.selectors.commentSend
              );

        console.log(
            '[测试] like元素：',
            element1
        );

        if (!element1) {
            console.log(
                '[测试] 找不到like按钮'
            );
            return;
        }

        console.log(
            '[测试] click 类型：',
            typeof element1.click
        );

        element1.click();
        addLog(
            `发送评论：${CONFIG.comment}`,
            'info'
        );
    }

    function simulateContentEditableInput(
    element,
     value
    ) {
        element.focus();

        element.textContent = value;

        element.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    inputType: 'insertText',
                    data: value
                }
            )
        );

        element.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );
    }
    // 处理关注
    async function handleFollow() {
        const button =
              await waitForElement(
                  CONFIG.selectors.follow
              );

        const textElement =
              button.querySelector(
                  '.reds-button-new-text'
              );

        const text =
              textElement
        ? textElement.textContent.trim()
        : button.textContent.trim();

        if (text === '已关注') {
            addLog(
                '已经关注，跳过',
                'info'
            );

            return;
        }

        if (text === '关注') {
            document.querySelector(CONFIG.selectors.follow).click()

            addLog(
                '执行关注',
                'info'
            );

            return;
        }

        throw new Error(
            `未知关注状态：${text}`
    );
}

    // 点击关闭按钮 1
    async function handleClose1() {
        const element =
              await waitForElement(
                  CONFIG.selectors.close1
              );

        document.querySelector(CONFIG.selectors.close1).click();

        addLog(
            '点击第一个关闭按钮',
            'info'
        );

        await sleep(
            CONFIG.closeDelay
        );
    }

    // 点击关闭按钮 2
    async function handleClose2() {
        const element =
              await waitForElement(
                  CONFIG.selectors.close2
              );

        document.querySelector(CONFIG.selectors.close2).click();

        addLog(
            '点击第二个关闭按钮',
            'info'
        );

        await sleep(
            CONFIG.closeDelay
        );
    }
    // 模拟输入
    function simulateInput(
    element,
     value
    ) {
        element.focus();

        if (
            element instanceof
            HTMLInputElement ||
            element instanceof
            HTMLTextAreaElement
        ) {
            const prototype =
                  element instanceof
                  HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;

            const setter =
                  Object.getOwnPropertyDescriptor(
                      prototype,
                      'value'
                  )?.set;

            if (setter) {
                setter.call(
                    element,
                    value
                );
            } else {
                element.value =
                    value;
            }
        } else {
            element.textContent =
                value;
        }

        element.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    inputType:
                    'insertText',
                    data: value
                }
            )
        );

        element.dispatchEvent(
            new Event(
                'change',
                {
                    bubbles: true
                }
            )
        );
    }

    // 判断按钮是否已经激活
    function isAlreadyActive(element) {
        const className =
              String(
                  element.className || ''
              ).toLowerCase();

        const ariaPressed =
              element.getAttribute(
                  'aria-pressed'
              );

        const ariaChecked =
              element.getAttribute(
                  'aria-checked'
              );

        const dataActive =
              element.getAttribute(
                  'data-active'
              );

        const title =
              String(
                  element.getAttribute(
                      'title'
                  ) || ''
              ).toLowerCase();

        const text =
              String(
                  element.textContent || ''
              ).trim();

        return (
            className.includes(
                'active'
            ) ||
            className.includes(
                'liked'
            ) ||
            className.includes(
                'collected'
            ) ||
            className.includes(
                'followed'
            ) ||
            ariaPressed === 'true' ||
            ariaChecked === 'true' ||
            dataActive === 'true' ||
            title.includes(
                '已点赞'
            ) ||
            title.includes(
                '已收藏'
            ) ||
            title.includes(
                '已关注'
            ) ||
            text === '已点赞' ||
            text === '已收藏' ||
            text === '已关注'
        );
    }

    // 等待元素出现
    function waitForElement(
    selector
    ) {
        return new Promise(
            (resolve, reject) => {

                const start =
                      Date.now();

                const timer =
                      setInterval(
                          () => {

                              if (
                                  !processing
                              ) {
                                  clearInterval(
                                      timer
                                  );

                                  reject(
                                      new Error(
                                          '任务已停止'
                                      )
                                  );

                                  return;
                              }

                              const element =
                                    document.querySelector(
                                        selector
                                    );

                              if (element) {
                                  clearInterval(
                                      timer
                                  );

                                  resolve(
                                      element
                                  );

                                  return;
                              }

                              if (
                                  Date.now() -
                                  start >=
                                  CONFIG.elementTimeout
                              ) {
                                  clearInterval(
                                      timer
                                  );

                                  reject(
                                      new Error(
                                          `找不到元素：${selector}`
                                    )
                                );
                            }

                        },
                        100
                    );
            }
        );
        }

    // 保存当前任务
    function saveCurrentTask(task) {
        const data = getData();

        data.currentTask = task;

        saveData(data);

        render();
    }

    // 完成当前任务
    function finishTask(task) {
        const data = getData();

        task.status = 'processed';

        task.step = 'completed';

        task.processedAt =
            Date.now();

        task.error = null;

        data.processed.unshift(
            task
        );

        data.currentTask = null;

        saveData(data);

        runningTaskId = null;

        addLog(
            `处理完成：${task.value}`,
            'info'
        );

        render();

        setTimeout(
            () => {
                processNextTask();
            },
            CONFIG.actionDelay
        );
    }

    // 任务失败
    function failTask(
    task,
     error
    ) {
        processing = false;

        const data = getData();

        task.status = 'error';

        task.error =
            error instanceof Error
            ? error.message
        : String(error);

        data.currentTask = task;

        saveData(data);

        addLog(
            `处理失败：${task.value} | ${task.error}`,
            'error'
        );

        render();
    }

    // 移除当前任务
    function removeCurrentTask() {
        const data = getData();

        if (!data.currentTask) {
            addLog(
                '当前没有任务可以移除',
                'warning'
            );

            return;
        }

        const task =
              data.currentTask;

        data.currentTask = null;

        saveData(data);

        processing = false;

        runningTaskId = null;

        addLog(
            `已移除当前任务：${task.value}`,
            'warning'
        );

        render();
    }

    // 清空已处理任务
    function clearProcessed() {
        const data = getData();

        data.processed = [];

        saveData(data);

        addLog(
            '已清空已处理列表',
            'warning'
        );

        render();
    }
// 初始化面板拖动功能
function enablePanelDrag() {
    const panel =
        document.querySelector(
            '#automation-panel'
        );

    const header =
        document.querySelector(
            '#automation-panel-header'
        );

    if (!panel || !header) {
        return;
    }

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener(
        'mousedown',
        event => {
            if (
                event.button !== 0 ||
                event.target.closest('button')
            ) {
                return;
            }

            const rect =
                panel.getBoundingClientRect();

            dragging = true;

            offsetX =
                event.clientX - rect.left;

            offsetY =
                event.clientY - rect.top;

            panel.style.left =
                `${rect.left}px`;

            panel.style.top =
                `${rect.top}px`;

            panel.style.right =
                'auto';

            panel.style.bottom =
                'auto';

            document.body.style.userSelect =
                'none';
        }
    );

    document.addEventListener(
        'mousemove',
        event => {
            if (!dragging) {
                return;
            }

            panel.style.left =
                `${event.clientX - offsetX}px`;

            panel.style.top =
                `${event.clientY - offsetY}px`;
        }
    );

    document.addEventListener(
        'mouseup',
        () => {
            if (!dragging) {
                return;
            }

            dragging = false;

            document.body.style.userSelect =
                '';
        }
    );
}
    // 创建面板
    function createPanel() {
        if (
            document.querySelector(
                '#automation-panel'
            )
        ) {
            return;
        }

        const panel =
              document.createElement('div');

        panel.id =
            'automation-panel';

        panel.innerHTML = `
            <div class="automation-header">
            <div
    id="automation-panel-header"
    class="automation-panel-header"
>
                <span>
                    自动化测试控制台
                </span>
</div>
                <button
                    id="automation-refresh"
                >
                    ↻
                </button>
            </div>

            <div class="automation-body">

                <div class="automation-label">
                    批量任务
                </div>

                <textarea
                    id="automation-input"
                    placeholder="一行一个任务内容..."
                ></textarea>

                <div class="automation-buttons">

                    <button
                        id="automation-add"
                    >
                        添加
                    </button>

                    <button
                        id="automation-start"
                    >
                        开始
                    </button>

                    <button
                        id="automation-stop"
                    >
                        停止
                    </button>

                </div>

                <div class="automation-buttons">

                    <button
                        id="automation-remove-current"
                    >
                        移除当前任务
                    </button>

                    <button
                        id="automation-clear-processed"
                    >
                        清空已处理
                    </button>

                </div>

                <div class="automation-status">
                    <span>
                        运行状态
                    </span>

                    <span
                        id="automation-running"
                    >
                        已停止
                    </span>
                </div>

                <div class="automation-section">

                    <div class="automation-title">
                        <span>
                            待处理
                        </span>

                        <span
                            id="pending-count"
                        >
                            0
                        </span>
                    </div>

                    <div
                        id="pending-list"
                        class="automation-list"
                    ></div>

                </div>

                <div class="automation-section">

                    <div class="automation-title">
                        <span>
                            已处理
                        </span>

                        <span
                            id="processed-count"
                        >
                            0
                        </span>
                    </div>

                    <div
                        id="processed-list"
                        class="automation-list"
                    ></div>

                </div>

                <div class="automation-section">

                    <div class="automation-title">
                        当前任务
                    </div>

                    <div
                        id="current-task"
                        class="automation-current"
                    ></div>

                </div>

                <div class="automation-section">

                    <div class="automation-title">
                        日志
                    </div>

                    <div
                        id="automation-logs"
                        class="automation-logs"
                    ></div>

                </div>

            </div>
        `;

    document.body.appendChild(
        panel
    );

    addStyle();

    bindEvents();

    render();
}

    // 添加面板样式
    function addStyle() {
        const style =
              document.createElement(
                  'style'
              );

        style.textContent = `
            #automation-panel {
                position: fixed;

                top: 20px;
                right: 20px;

                width: 400px;

                background: #fff;

                color: #222;

                border: 1px solid #ccc;

                border-radius: 8px;

                box-shadow:
                    0 5px 25px
                    rgba(0,0,0,.25);

                z-index: 2147483647;

                font-family:
                    Arial,
                    "Microsoft YaHei",
                    sans-serif;

                font-size: 13px;
            }
            .automation-panel-header {
    display: flex;

    align-items: center;

    justify-content: space-between;

    cursor: move;

    user-select: none;

    padding: 8px 10px;



    border-bottom: 1px solid #ddd;
}

.automation-panel-actions {
    display: flex;

    align-items: center;

    gap: 5px;
}

.automation-panel-header button {
    cursor: pointer;
}
.automation-item {
    display: flex;

    align-items: center;

    justify-content: space-between;

    gap: 8px;

    padding: 7px;

    border-bottom: 1px solid #eee;

    word-break: break-all;
}

.automation-task-content {
    flex: 1;

    min-width: 0;
}

.automation-task-index {
    margin-right: 3px;
}

.automation-task-value {
    word-break: break-all;
}

.automation-remove-task {
    flex-shrink: 0;

    padding: 3px 8px;

    border: 1px solid #ddd;

    border-radius: 4px;

    background: #fff;

    color: #d00;

    cursor: pointer;

    font-size: 12px;
}

.automation-remove-task:hover {
    background: #f5f5f5;
}
            .automation-header {
                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                padding: 10px 12px;

                background: #1677ff;

                color: white;

                border-radius:
                    8px 8px 0 0;

                font-size: 15px;

                font-weight: bold;
            }

            .automation-header button {
                border: none;

                background:
                    rgba(255,255,255,.2);

                color: white;

                width: 30px;

                height: 30px;

                border-radius: 5px;

                cursor: pointer;

                font-size: 18px;
            }

            .automation-body {
                padding: 12px;

                max-height: 85vh;

                overflow-y: auto;
            }

            .automation-label {
                margin-bottom: 6px;

                font-weight: bold;
            }

            #automation-input {
                width: 100%;

                height: 90px;

                box-sizing: border-box;

                resize: vertical;

                padding: 8px;

                border: 1px solid #ccc;

                border-radius: 5px;

                outline: none;

                font-family: inherit;
            }

            .automation-buttons {
                display: flex;

                gap: 6px;

                margin-top: 8px;
            }

            .automation-buttons button {
                flex: 1;

                height: 34px;

                border: none;

                border-radius: 5px;

                background: #1677ff;

                color: white;

                cursor: pointer;
            }

            .automation-status {
                display: flex;

                justify-content:
                    space-between;

                margin-top: 12px;

                padding: 8px;

                border-radius: 5px;

                background: #f5f5f5;

                font-weight: bold;
            }

            .automation-section {
                margin-top: 14px;
            }

            .automation-title {
                display: flex;

                justify-content:
                    space-between;

                margin-bottom: 6px;

                font-weight: bold;
            }

            .automation-title span:last-child {
                min-width: 24px;

                padding: 2px 6px;

                border-radius: 10px;

                background: #eee;

                text-align: center;

                font-size: 11px;
            }

            .automation-list {
                max-height: 150px;

                overflow-y: auto;

                border: 1px solid #ddd;

                border-radius: 5px;

                background: #fafafa;
            }

            .automation-item {
                padding: 7px;

                border-bottom:
                    1px solid #eee;

                word-break: break-all;
            }

            .automation-item:last-child {
                border-bottom: none;
            }

            .automation-empty {
                padding: 12px;

                color: #999;

                text-align: center;
            }

            .automation-current {
                padding: 8px;

                border: 1px solid #ddd;

                border-radius: 5px;

                background: #fafafa;

                word-break: break-all;
            }

            .automation-current-step {
                margin-top: 5px;

                font-weight: bold;
            }

            .automation-current-error {
                margin-top: 5px;

                color: #d00;
            }

            .automation-logs {
                max-height: 220px;

                overflow-y: auto;

                border: 1px solid #ddd;

                border-radius: 5px;

                background: #fafafa;
            }

            .automation-log {
                padding: 5px 7px;

                border-bottom:
                    1px solid #eee;

                font-size: 11px;

                word-break: break-all;
            }

            .automation-log-error {
                color: #d00;
            }

            .automation-log-warning {
                color: #b07800;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // 绑定面板事件
    function bindEvents() {

        document
            .querySelector(
            '#automation-add'
        )
            .addEventListener(
            'click',
            () => {

                const input =
                      document.querySelector(
                          '#automation-input'
                      );

                if (
                    !input.value.trim()
                ) {
                    return;
                }

                addTasks(
                    input.value
                );

                input.value = '';
            }
        );

        document
            .querySelector(
            '#automation-start'
        )
            .addEventListener(
            'click',
            startProcessing
        );

        document
            .querySelector(
            '#automation-stop'
        )
            .addEventListener(
            'click',
            stopProcessing
        );

        document
            .querySelector(
            '#automation-remove-current'
        )
            .addEventListener(
            'click',
            removeCurrentTask
        );

        document
            .querySelector(
            '#automation-clear-processed'
        )
            .addEventListener(
            'click',
            clearProcessed
        );

        document
            .querySelector(
            '#automation-refresh'
        )
            .addEventListener(
            'click',
            render
        );
        document
            .querySelector(
            '#pending-list'
        )
            .addEventListener(
            'click',
            event => {

                const button =
                      event.target.closest(
                          '.automation-remove-task'
                      );

                if (!button) {
                    return;
                }

                const taskId =
                      button.dataset.taskId;

                removePendingTask(
                    taskId
                );
            }
        );
    }

    // 刷新面板
    function render() {
        const data = getData();

        const pendingList =
              document.querySelector(
                  '#pending-list'
              );

        const processedList =
              document.querySelector(
                  '#processed-list'
              );

        const currentTask =
              document.querySelector(
                  '#current-task'
              );

        const pendingCount =
              document.querySelector(
                  '#pending-count'
              );

        const processedCount =
              document.querySelector(
                  '#processed-count'
              );

        const running =
              document.querySelector(
                  '#automation-running'
              );

        if (!pendingList) {
            return;
        }

        pendingCount.textContent =
            data.pending.length;

        processedCount.textContent =
            data.processed.length;

        running.textContent =
            processing
            ? '运行中'
        : '已停止';

        pendingList.innerHTML = '';

        if (
            data.pending.length === 0
        ) {
            pendingList.innerHTML = `
                <div class="automation-empty">
                    暂无待处理
                </div>
            `;
        } else {
            data.pending.forEach(
                (task, index) => {

                    const item =
                          document.createElement(
                              'div'
                          );

                    item.className =
                        'automation-item';

                    item.innerHTML = `
            <div class="automation-task-content">
                <span class="automation-task-index">
                    ${index + 1}.
                </span>

                <span class="automation-task-value">
                    ${escapeHtml(task.value)}
                </span>
            </div>

            <button
                class="automation-remove-task"
                data-task-id="${escapeHtml(task.id)}"
            >
                移除
            </button>
        `;

        pendingList.appendChild(
            item
        );
    }
            );
        }

        processedList.innerHTML = '';

        if (
            data.processed.length === 0
        ) {
            processedList.innerHTML = `
                <div class="automation-empty">
                    暂无已处理
                </div>
            `;
        } else {
            data.processed.forEach(
                (task, index) => {

                    const item =
                          document.createElement(
                              'div'
                          );

                    item.className =
                        'automation-item';

                    item.innerHTML = `
                        <div>

                            ${escapeHtml(
                        task.value
                    )}
                        </div>

                        <div
                            style="
                                margin-top:3px;
                                color:#777;
                                font-size:11px;
                            "
                        >

                        </div>
                    `;

                    processedList.appendChild(
                        item
                    );
                }
            );
        }

        if (!data.currentTask) {
            currentTask.innerHTML = `
                <div class="automation-empty">
                    当前没有任务
                </div>
            `;
        } else {
            const task =
                  data.currentTask;

            currentTask.innerHTML = `
                <div>
                    ${escapeHtml(
                task.value
            )}
                </div>

                <div
                    class="automation-current-step"
                >
                    当前步骤：
                    ${escapeHtml(
                getStepName(
                    task.step
                )
            )}
                </div>

                ${
                    task.error
                ? `
                            <div
                                class="
                                    automation-current-error
                                "
                            >
                                ${escapeHtml(
                task.error
            )}
                            </div>
                        `
                        : ''
        }
            `;
        }

        renderLogs();
    }

    // 刷新日志
    function renderLogs() {
        const container =
              document.querySelector(
                  '#automation-logs'
              );

        if (!container) {
            return;
        }

        const data = getData();

        container.innerHTML = '';

        data.logs
            .slice(0, 100)
            .forEach(log => {

            const item =
                  document.createElement(
                      'div'
                  );

            item.className =
                `automation-log automation-log-${log.level}`;

            item.textContent =
                `[${log.time}] ${log.message}`;

            container.appendChild(
                item
            );
        });
    }

    // 转义 HTML
    function escapeHtml(value) {
        return String(value)
            .replace(
            /&/g,
            '&amp;'
        )
            .replace(
            /</g,
            '&lt;'
        )
            .replace(
            />/g,
            '&gt;'
        )
            .replace(
            /"/g,
            '&quot;'
        )
            .replace(
            /'/g,
            '&#039;'
        );
    }

    // 等待指定时间
    function sleep(ms) {
        return new Promise(
            resolve => {
                setTimeout(
                    resolve,
                    ms
                );
            }
        );
    }
    // 移除待处理区指定任务
    function removePendingTask(taskId) {
        const data = getData();

        const index = data.pending.findIndex(
            task => task.id === taskId
        );

        if (index === -1) {
            addLog(
                '待处理任务不存在',
                'warning'
            );

            return;
        }

        const task =
              data.pending[index];

        data.pending.splice(index, 1);

        saveData(data);

        addLog(
            `移除待处理任务：${task.value}`,
            'warning'
        );

        render();
    }
    // 初始化脚本
    function init() {
        createPanel();
enablePanelDrag();
        const data = getData();

        if (data.currentTask) {
            addLog(
                `检测到未完成任务：${data.currentTask.value}`,
                'warning'
            );
        }
    }

    init();

})();
