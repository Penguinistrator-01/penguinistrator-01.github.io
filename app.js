/* ========== fireflymax — 萤火之匣 终端逻辑 ========== */

(function() {
    'use strict';

    // ========== 虚拟文件系统 ==========
    // 定义目录结构和文件列表，新增内容时只需更新这里
    const VFS = {
        '/': {
            dirs: ['blog', 'projects'],
            files: ['about.html']
        },
        '/blog/': {
            dirs: [],
            files: ['chun_jie.html', 'hello-world.html']
        },
        '/projects/': {
            dirs: [],
            files: ['sncak.html','demo.html']
        }
    };

    // ========== 状态 ==========
    let currentPath = '/';
    let commandHistory = [];
    let historyIndex = -1;
    let currentSuggestions = [];

    // ========== DOM 引用 ==========
    const terminalInput = document.getElementById('terminalInput');
    const terminalOutput = document.getElementById('terminalOutput');
    const promptEl = document.getElementById('prompt');
    const suggestionsEl = document.getElementById('suggestions');
    const suggestionsList = document.getElementById('suggestionsList');

    // ========== 初始化 ==========
    function init() {
        updatePrompt();
        terminalInput.focus();

        // 事件监听
        terminalInput.addEventListener('input', onInput);
        terminalInput.addEventListener('keydown', onKeydown);

        // 点击页面任意位置聚焦输入框
        document.addEventListener('click', function(e) {
            // 如果点击的是交互元素，不重新聚焦
            if (e.target.closest('.suggestion-item')) return;
            if (e.target.closest('.music-control')) return;
            if (e.target.closest('#diamondToggle')) return;
            terminalInput.focus();
        });

        // 点击建议项
        suggestionsList.addEventListener('click', function(e) {
            const item = e.target.closest('.suggestion-item');
            if (!item) return;
            const value = item.dataset.value;
            if (value) {
                selectSuggestion(value);
            }
        });

        // 背景音乐控制
        setupMusic();
        // 菱形切换背景
        setupDiamondToggle();
    }

    // ========== 更新提示符 ==========
    function updatePrompt() {
        promptEl.textContent = 'fireflymax:~' + (currentPath === '/' ? '' : currentPath.slice(0, -1)) + '$';
    }

    // ========== 获取当前目录内容 ==========
    function getCurrentDir() {
        return VFS[currentPath] || { dirs: [], files: [] };
    }

    // ========== 输入事件 ==========
    function onInput() {
        const value = terminalInput.value;
        detectAndShowSuggestions(value);
    }

    // ========== 检测命令并显示建议 ==========
    function detectAndShowSuggestions(value) {
        // cd + 空格 → 显示目录建议
        if (/^cd\s+.?$/.test(value) || /^cd\s+\S/.test(value)) {
            const partial = value.replace(/^cd\s+/, '').toLowerCase();
            const dirs = getCurrentDir().dirs;
            const matches = dirs.filter(function(d) {
                return d.toLowerCase().indexOf(partial) !== -1;
            });
            showSuggestions('dir', matches, partial);
            return;
        }

        // cat + 空格 → 显示文件建议
        if (/^cat\s+.?$/.test(value) || /^cat\s+\S/.test(value)) {
            const partial = value.replace(/^cat\s+/, '').toLowerCase();
            const files = getCurrentDir().files;
            const matches = files.filter(function(f) {
                return f.toLowerCase().indexOf(partial) !== -1;
            });
            showSuggestions('file', matches, partial);
            return;
        }

        // back, kill, new → 不显示建议，但如果是部分匹配也不显示
        hideSuggestions();
    }

    // ========== 显示建议下拉 ==========
    function showSuggestions(type, matches, partial) {
        currentSuggestions = matches;
        suggestionsList.innerHTML = '';

        if (matches.length === 0) {
            suggestionsList.innerHTML = '<div class="suggestion-no-results">没有匹配的结果</div>';
        } else {
            matches.forEach(function(item, index) {
                const div = document.createElement('div');
                div.className = 'suggestion-item' + (index === 0 ? ' active' : '');
                div.dataset.value = item;
                div.dataset.index = index;

                const icon = document.createElement('i');
                icon.className = type === 'dir' ? 'fas fa-folder' : 'fas fa-file-alt';

                const span = document.createElement('span');
                // 高亮匹配部分
                if (partial && item.toLowerCase().indexOf(partial) !== -1) {
                    const idx = item.toLowerCase().indexOf(partial);
                    span.innerHTML =
                        escapeHtml(item.substring(0, idx)) +
                        '<span class="suggestion-match">' +
                        escapeHtml(item.substring(idx, idx + partial.length)) +
                        '</span>' +
                        escapeHtml(item.substring(idx + partial.length));
                } else {
                    span.textContent = item;
                }

                div.appendChild(icon);
                div.appendChild(span);
                suggestionsList.appendChild(div);
            });
        }

        suggestionsEl.classList.add('active');
    }

    // ========== 隐藏建议下拉 ==========
    function hideSuggestions() {
        suggestionsEl.classList.remove('active');
        currentSuggestions = [];
    }

    // ========== 选择建议项 ==========
    function selectSuggestion(value) {
        const cmd = terminalInput.value.split(/\s+/)[0];
        terminalInput.value = cmd + ' ' + value;
        hideSuggestions();
        terminalInput.focus();
    }

    // ========== 键盘事件 ==========
    function onKeydown(e) {
        // Tab 键 — 选择第一个建议
        if (e.key === 'Tab') {
            e.preventDefault();
            if (currentSuggestions.length > 0) {
                selectSuggestion(currentSuggestions[0]);
            }
            return;
        }

        // 上/下箭头 — 在建议列表中导航
        if (e.key === 'ArrowDown' && suggestionsEl.classList.contains('active')) {
            e.preventDefault();
            navigateSuggestion(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            if (suggestionsEl.classList.contains('active')) {
                e.preventDefault();
                navigateSuggestion(-1);
                return;
            }
            // 如果没有建议，上箭头浏览历史
            if (commandHistory.length > 0) {
                e.preventDefault();
                navigateHistory(-1);
                return;
            }
        }

        // Enter — 执行命令
        if (e.key === 'Enter') {
            e.preventDefault();

            // 如果有活跃的建议且第一个被选中，先自动补全
            const activeSuggestion = suggestionsList.querySelector('.suggestion-item.active');
            if (activeSuggestion && currentSuggestions.length > 0) {
                selectSuggestion(activeSuggestion.dataset.value);
                return;
            }

            const cmd = terminalInput.value.trim();
            if (cmd) {
                executeCommand(cmd);
            }
            return;
        }

        // Escape — 隐藏建议
        if (e.key === 'Escape') {
            hideSuggestions();
            return;
        }
    }

    // ========== 建议列表导航 ==========
    function navigateSuggestion(delta) {
        const items = suggestionsList.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        let activeIndex = -1;
        items.forEach(function(item, i) {
            if (item.classList.contains('active')) {
                activeIndex = i;
            }
        });

        items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex + delta + items.length) % items.length;
        items[activeIndex].classList.add('active');

        // 滚动到可见区域
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    // ========== 命令历史导航 ==========
    function navigateHistory(delta) {
        historyIndex += delta;
        if (historyIndex < 0) historyIndex = -1;
        if (historyIndex >= commandHistory.length) historyIndex = commandHistory.length - 1;

        if (historyIndex === -1) {
            terminalInput.value = '';
        } else {
            terminalInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
    }

    // ========== 执行命令 ==========
    function executeCommand(cmd) {
        // 加入历史
        commandHistory.push(cmd);
        if (commandHistory.length > 50) commandHistory.shift();
        historyIndex = -1;

        // 清空输入
        terminalInput.value = '';
        hideSuggestions();

        // 在输出区回显命令
        appendOutput('cmd-echo', 'fireflymax:~' + (currentPath === '/' ? '' : currentPath.slice(0, -1)) + '$ ' + cmd);

        // 解析命令
        const parts = cmd.split(/\s+/);
        const command = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        switch (command) {
            case 'cd':
                handleCd(arg);
                break;
            case 'cat':
                handleCat(arg);
                break;
            case 'back':
                handleBack();
                break;
            case 'kill':
                handleKill();
                break;
            case 'new':
                handleNew();
                break;
            case 'help':
                handleHelp();
                break;
            case 'ls':
                handleLs();
                break;
            case 'clear':
                handleClear();
                break;
            case 'pwd':
                appendOutput('cmd-result', currentPath);
                break;
            default:
                appendOutput('cmd-error', '未知指令: ' + escapeHtml(command) + '（输入 help 查看可用指令）');
        }

        // 滚动输出区到底部
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // ========== cd: 导航到子目录 ==========
    function handleCd(arg) {
        if (!arg) {
            appendOutput('cmd-error', 'cd: 缺少参数。可用目录: ' + getCurrentDir().dirs.join(', '));
            return;
        }

        const targetDir = arg.trim();
        const currentDir = getCurrentDir();

        if (currentDir.dirs.indexOf(targetDir) !== -1) {
            currentPath = currentPath + targetDir + '/';
            updatePrompt();
            appendOutput('cmd-success', '已导航到 ' + currentPath);
        } else {
            appendOutput('cmd-error', 'cd: 目录不存在: ' + escapeHtml(targetDir) + '（可用目录: ' + currentDir.dirs.join(', ') + '）');
        }
    }

    // ========== cat: 查阅 HTML 文件 ==========
    function handleCat(arg) {
        if (!arg) {
            appendOutput('cmd-error', 'cat: 缺少参数。可用文件: ' + getCurrentDir().files.join(', '));
            return;
        }

        let targetFile = arg.trim();
        // 如果不带 .html 后缀，自动补全
        if (!targetFile.endsWith('.html')) {
            targetFile += '.html';
        }

        const currentDir = getCurrentDir();

        if (currentDir.files.indexOf(targetFile) !== -1) {
            // 使用相对路径，避免 file:// 协议下 / 开头解析到盘符根目录
            const url = (currentPath === '/' ? './' : '.' + currentPath) + targetFile;
            appendOutput('cmd-success', '正在打开: ' + url + ' ...');
            // 跳转到目标 HTML 文件
            setTimeout(function() {
                window.location.href = url;
            }, 300);
        } else {
            appendOutput('cmd-error', 'cat: 文件不存在: ' + escapeHtml(targetFile) + '（可用文件: ' + currentDir.files.join(', ') + '）');
        }
    }

    // ========== back: 返回上级目录 ==========
    function handleBack() {
        if (currentPath === '/') {
            appendOutput('cmd-result', '已在根目录');
            return;
        }

        // 去掉当前目录，回到上级
        const parts = currentPath.split('/').filter(function(p) { return p !== ''; });
        parts.pop();
        currentPath = parts.length === 0 ? '/' : '/' + parts.join('/') + '/';
        updatePrompt();
        appendOutput('cmd-success', '已返回 ' + (currentPath === '/' ? '根目录' : currentPath));
    }

    // ========== kill: 退出网页 ==========
    function handleKill() {
        appendOutput('cmd-result', '再见，fireflymax。');
        setTimeout(function() {
            // 尝试关闭窗口，如果不行则跳转到空白页
            window.open('', '_self', '');
            window.close();
            // 如果 close 不起作用（大多数浏览器限制），跳转
            setTimeout(function() {
                window.location.href = 'about:blank';
            }, 200);
        }, 500);
    }

    // ========== new: 新建窗口 ==========
    function handleNew() {
        appendOutput('cmd-success', '正在打开新窗口...');
        window.open(window.location.href, '_blank');
    }

    // ========== help: 显示帮助 ==========
    function handleHelp() {
        appendOutput('cmd-result', '可用指令:');
        appendOutput('cmd-result', '  cd <目录>  — 导航到子目录');
        appendOutput('cmd-result', '  cat <文件>  — 查阅当前目录的 .html 文件');
        appendOutput('cmd-result', '  back       — 返回上级目录');
        appendOutput('cmd-result', '  kill       — 退出网页');
        appendOutput('cmd-result', '  new        — 新建窗口');
        appendOutput('cmd-result', '  ls         — 列出当前目录内容');
        appendOutput('cmd-result', '  pwd        — 显示当前路径');
        appendOutput('cmd-result', '  clear      — 清空输出');
        appendOutput('cmd-result', '  help       — 显示此帮助');
    }

    // ========== ls: 列出目录内容 ==========
    function handleLs() {
        const d = getCurrentDir();
        if (d.dirs.length > 0) {
            d.dirs.forEach(function(dir) {
                appendOutput('cmd-result', '  📁 ' + dir + '/');
            });
        }
        if (d.files.length > 0) {
            d.files.forEach(function(file) {
                appendOutput('cmd-result', '  📄 ' + file);
            });
        }
        if (d.dirs.length === 0 && d.files.length === 0) {
            appendOutput('cmd-result', '  （空目录）');
        }
    }

    // ========== clear: 清空输出 ==========
    function handleClear() {
        terminalOutput.innerHTML = '';
    }

    // ========== 输出辅助 ==========
    function appendOutput(className, text) {
        const line = document.createElement('div');
        line.className = 'output-line ' + className;
        line.innerHTML = text;
        terminalOutput.appendChild(line);
    }

    // ========== HTML 转义 ==========
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ========== 背景音乐 ==========
    function setupMusic() {
        var audio = document.getElementById('bgMusic');
        var musicControl = document.getElementById('musicControl');
        var musicIcon = document.getElementById('musicIcon');
        var musicWave = document.getElementById('musicWave');

        if (!audio || !musicControl) return;

        var isPlaying = true;
        audio.volume = 0.35;

        function updateUI() {
            if (isPlaying) {
                musicControl.classList.add('playing');
                musicIcon.className = 'fas fa-volume-up';
                if (musicWave) musicWave.classList.add('animating');
            } else {
                musicControl.classList.remove('playing');
                musicIcon.className = 'fas fa-volume-mute';
                if (musicWave) musicWave.classList.remove('animating');
            }
        }

        audio.play().then(function() {
            isPlaying = true;
            updateUI();
        }).catch(function() {
            isPlaying = false;
            updateUI();
            function resumeMusic() {
                if (!isPlaying) {
                    isPlaying = true;
                    updateUI();
                    audio.play().catch(function() {});
                }
            }
            document.addEventListener('click', function handler() { resumeMusic(); }, { once: true });
            document.addEventListener('touchstart', function handler() { resumeMusic(); }, { once: true });
        });

        musicControl.addEventListener('click', function(e) {
            e.stopPropagation();
            if (isPlaying) {
                audio.pause();
                isPlaying = false;
            } else {
                isPlaying = true;
                audio.play().catch(function() {});
            }
            updateUI();
        });

        audio.addEventListener('play', function() { isPlaying = true; updateUI(); });
        audio.addEventListener('pause', function() { isPlaying = false; updateUI(); });
    }

    // ========== 菱形切换背景 ==========
    function setupDiamondToggle() {
        var diamond = document.getElementById('diamondToggle');
        var frosted = document.getElementById('bgFrosted');
        if (!diamond || !frosted) return;

        var bgAlt = false;

        diamond.addEventListener('click', function(e) {
            e.stopPropagation();
            bgAlt = !bgAlt;
            if (bgAlt) {
                frosted.classList.add('active');
                diamond.classList.add('bg-alt');
                document.body.classList.add('bg-alt');
            } else {
                frosted.classList.remove('active');
                diamond.classList.remove('bg-alt');
                document.body.classList.remove('bg-alt');
            }
        });
    }

    // ========== 启动 ==========
    init();

})();
