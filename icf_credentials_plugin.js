/**
 * ICF Collect — Combined Plugin v1.0
 * =====================================
 * Includes:
 *  1. Form Access Credentials (login gate on shared forms)
 *  2. Cascadeuser validation fix (stops blocking Next Page)
 *  3. Cascadeuser login fix (text input instead of dropdown)
 *
 * INSTALL: One line before </body>:
 *   <script src="icf_collect_plugins.js"></script>
 */

(function () {
    'use strict';

    // ============================================================
    // PART 1 — CSS
    // ============================================================
    var css = `
    #credentialsPanel {
        margin-top: 20px; padding: 14px; background: #f8faff;
        border: 1px solid #d0e0f5; border-radius: 8px;
    }
    #sharedFormLoginGate {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(135deg, #004080, #001a33);
        display: none; justify-content: center; align-items: center;
        z-index: 9999; padding: 20px; font-family: 'Oswald', Arial, sans-serif;
    }
    #sharedFormLoginGate.show { display: flex; }
    .sfg-card {
        background: #fff; border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,.3);
        padding: 40px 36px; width: 100%; max-width: 420px;
    }
    .sfg-logo { text-align: center; margin-bottom: 28px; }
    .sfg-logo .sfg-icon { font-size: 44px; display: block; margin-bottom: 12px; }
    .sfg-logo h2 { margin: 0 0 6px; font-size: 20px; color: #004080; font-weight: 700; }
    .sfg-logo p  { margin: 0; font-size: 13px; color: #666; }
    .sfg-msg { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 14px; display: none; }
    .sfg-msg.error   { background: #fff0f0; border: 1px solid #ffcccc; color: #cc0000; display: block; }
    .sfg-msg.success { background: #f0fff4; border: 1px solid #c3e6cb; color: #155724; display: block; }
    .sfg-fields { display: flex; flex-direction: column; gap: 16px; }
    .sfg-group label {
        display: block; font-size: 11px; font-weight: 700; color: #444;
        margin-bottom: 5px; text-transform: uppercase; letter-spacing: .5px;
    }
    .sfg-group input {
        width: 100%; padding: 11px 13px; border: 2px solid #d0d9e8;
        border-radius: 8px; font-size: 14px; box-sizing: border-box;
        font-family: 'Oswald', sans-serif;
    }
    .sfg-group input:focus { outline: none; border-color: #004080; box-shadow: 0 0 0 3px rgba(0,64,128,.1); }
    .sfg-btn {
        background: #004080; color: #fff; border: none; border-radius: 8px;
        padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer;
        font-family: 'Oswald', sans-serif;
    }
    .sfg-btn:hover { background: #003060; }
    @keyframes sfgShake {
        0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
        40%{transform:translateX(8px)}  60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
    }
    .sfg-shake { animation: sfgShake .45s ease; }
    #shareNote { font-size: 12px; margin-top: 8px; padding: 8px 12px; border-radius: 6px; display: none; }
    `;
    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ============================================================
    // PART 2 — STATE
    // ============================================================
    window.formCredentials = [];

    // ============================================================
    // PART 3 — INJECT HTML + HOOK ON DOM READY
    // ============================================================
    document.addEventListener('DOMContentLoaded', function () {

        // --- Login gate (shared form) ---
        var notif = document.getElementById('notification');
        if (notif) {
            notif.insertAdjacentHTML('beforebegin', [
                '<div id="sharedFormLoginGate">',
                  '<div class="sfg-card">',
                    '<div class="sfg-logo">',
                      '<span class="sfg-icon">&#128274;</span>',
                      '<h2 id="sfgFormTitle">Form</h2>',
                      '<p>This form requires login to access.</p>',
                    '</div>',
                    '<div id="sfgMsg" class="sfg-msg"></div>',
                    '<div class="sfg-fields">',
                      '<div class="sfg-group">',
                        '<label>Username</label>',
                        '<input type="text" id="sfgUsername" placeholder="Enter your username" onkeydown="if(event.key===\'Enter\') sfgLogin()">',
                      '</div>',
                      '<div class="sfg-group">',
                        '<label>Password</label>',
                        '<input type="password" id="sfgPassword" placeholder="Enter your password" onkeydown="if(event.key===\'Enter\') sfgLogin()">',
                      '</div>',
                      '<button class="sfg-btn" onclick="sfgLogin()">Access Form &#8594;</button>',
                    '</div>',
                  '</div>',
                '</div>'
            ].join(''));
        }

        // --- Credentials panel in builder ---
        var propsPanel = document.getElementById('propertiesPanel');
        if (propsPanel && !document.getElementById('credentialsPanel')) {
            var cpDiv = document.createElement('div');
            cpDiv.id = 'credentialsPanel';
            propsPanel.appendChild(cpDiv);
        }

        // --- shareNote in share modal ---
        var qrActions = document.querySelector('#shareModal .qr-actions');
        if (qrActions && !document.getElementById('shareNote')) {
            var noteP = document.createElement('p');
            noteP.id = 'shareNote';
            qrActions.after(noteP);
        }

        // --- Hook app functions after inline scripts have run ---
        setTimeout(_hookAll, 400);
    });

    // ============================================================
    // PART 4 — HOOK ALL APP FUNCTIONS
    // ============================================================
    function _hookAll() {

        // ---- Fix: cascade CORS error no longer aborts share ----
        if (typeof window.saveCascadeDataToCloud === 'function') {
            var _origSaveCascade = window.saveCascadeDataToCloud;
            window.saveCascadeDataToCloud = async function () {
                try {
                    return await _origSaveCascade.apply(this, arguments);
                } catch (err) {
                    console.warn('[ICF Plugin] Cascade cloud save failed (non-fatal):', err.message);
                    if (typeof notify === 'function') {
                        notify('Cascade cloud save skipped \u2014 share link still generated', 'warning');
                    }
                    return false;
                }
            };
        }

        // ---- Hook shareForm: inject credentials via pako intercept ----
        var _origShare = window.shareForm;
        if (typeof _origShare === 'function') {
            window.shareForm = async function () {
                try {
                    window.formCredentials = JSON.parse(localStorage.getItem('icfFormCredentials') || '[]');
                } catch (e) { window.formCredentials = []; }

                if (window.pako && typeof window.pako.deflate === 'function') {
                    var _origDeflate = window.pako.deflate;
                    window.pako.deflate = function (data) {
                        window.pako.deflate = _origDeflate;
                        try {
                            var parsed = JSON.parse(data);
                            if (parsed && parsed.s) parsed.s.creds = window.formCredentials;
                            return _origDeflate(JSON.stringify(parsed));
                        } catch (e) {
                            return _origDeflate(data);
                        }
                    };
                }

                await _origShare.apply(this, arguments);

                var note = document.getElementById('shareNote');
                if (note) {
                    if (!window.formCredentials || window.formCredentials.length === 0) {
                        note.textContent = '\u26a0\ufe0f No credentials set \u2014 form is open to everyone.';
                        note.style.background = '#fff3cd'; note.style.color = '#856404';
                    } else {
                        note.textContent = '\ud83d\udd12 ' + window.formCredentials.length + ' credential(s) embedded. Users must log in.';
                        note.style.background = '#d4edda'; note.style.color = '#155724';
                    }
                    note.style.display = 'block';
                }
            };
        }

        // ---- Hook renderSharedForm: show login gate if creds present ----
        var _origRender = window.renderSharedForm;
        if (typeof _origRender === 'function') {
            window.renderSharedForm = async function (data) {
                var embeddedCreds = (data && data.s && data.s.creds) ? data.s.creds : [];
                if (embeddedCreds.length > 0) {
                    window._sfgCredentials = embeddedCreds;
                    var titleEl = document.getElementById('sfgFormTitle');
                    if (titleEl) titleEl.textContent = (data.s && data.s.t) ? data.s.t : 'Form';

                    var header   = document.querySelector('.header');
                    var footer   = document.querySelector('.footer');
                    var authCont = document.getElementById('authContainer');
                    var mainCont = document.getElementById('mainContainer');
                    if (header)   header.style.display  = 'none';
                    if (footer)   footer.style.display  = 'none';
                    if (authCont) authCont.style.display = 'none';
                    if (mainCont) mainCont.classList.remove('show');

                    var gate = document.getElementById('sharedFormLoginGate');
                    if (gate) gate.classList.add('show');

                    var vc = document.getElementById('viewerContainer');
                    if (vc) {
                        var _origAdd = vc.classList.add.bind(vc.classList);
                        vc.classList.add = function (cls) {
                            if (cls === 'show') { vc.classList.add = _origAdd; return; }
                            _origAdd(cls);
                        };
                    }
                    await _origRender.call(this, data);
                } else {
                    window._sfgCredentials = [];
                    await _origRender.call(this, data);
                }
            };
        }

        // ---- Hook showBuilder: render credentials panel ----
        var _origShowBuilder = window.showBuilder;
        if (typeof _origShowBuilder === 'function') {
            window.showBuilder = function () {
                _origShowBuilder.apply(this, arguments);
                setTimeout(window.renderCredentialsPanel, 100);
            };
        }

        // Render immediately if builder already visible
        var mc = document.getElementById('mainContainer');
        if (mc && mc.classList.contains('show')) {
            setTimeout(window.renderCredentialsPanel, 100);
        }

        // ---- Fix: cascadeuser validation (don't block Next Page) ----
        var _origValidate = window.validateCurrentPage;
        if (typeof _origValidate === 'function') {
            window.validateCurrentPage = function (currentPageIndex) {
                var pageEl = document.querySelector('.form-page[data-page="' + currentPageIndex + '"]');
                if (!pageEl) return true;

                var fieldEls = pageEl.querySelectorAll('.viewer-field');
                for (var i = 0; i < fieldEls.length; i++) {
                    var fieldEl = fieldEls[i];
                    if (fieldEl.classList.contains('field-hidden')) continue;

                    var fieldName = fieldEl.dataset.fieldName;
                    if (!fieldName) continue;

                    var fieldDef = (window.state && window.state.fields)
                        ? window.state.fields.find(function (f) { return f.name === fieldName; })
                        : null;

                    if (!fieldDef || fieldDef.type !== 'cascadeuser' || !fieldDef.required) continue;

                    var hidden = fieldEl.querySelector('input[type="hidden"][name="' + fieldName + '"]');
                    var val = hidden ? hidden.value.trim() : '';

                    if (!val) {
                        var existing = fieldEl.querySelector('.sfg-validate-err');
                        if (!existing) {
                            var err = document.createElement('div');
                            err.className = 'sfg-validate-err';
                            err.style.cssText = 'color:#dc3545;font-size:12px;margin-top:6px;padding:6px 10px;background:#fff5f5;border-radius:4px;border-left:3px solid #dc3545;';
                            err.textContent = '\u26a0 Please log in to continue.';
                            fieldEl.appendChild(err);
                        }
                        fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        if (typeof notify === 'function') notify('Please log in to the user field before continuing', 'error');
                        return false;
                    } else {
                        var prev = fieldEl.querySelector('.sfg-validate-err');
                        if (prev) prev.remove();
                    }
                }

                return _origValidate.apply(this, arguments);
            };
        }

        // ---- Fix: cascadeuser field — text input instead of dropdown ----
        window.renderCascadingUserField = function (field) {

            if (window.cascadingUserData && window.cascadingUserData.currentUser) {
                var user = window.cascadingUserData.currentUser;
                var cols = window.cascadingUserData.hierarchyColumns || [];

                var hierarchyRows = cols.map(function (col) {
                    return '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">' +
                        '<strong style="color:#004080;">' + col + ':</strong>' +
                        '<span>' + (user.hierarchy[col] || '') + '</span>' +
                        '</div>';
                }).join('');

                return '<div class="viewer-field" data-field-name="' + field.name + '">' +
                    '<label class="viewer-field-label">' + _esc(field.label) + '</label>' +
                    '<div style="background:#e8f4fc;border:2px solid #004080;border-radius:8px;padding:15px;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                            '<span style="font-weight:700;color:#004080;">&#10003; Logged in as ' + _esc(user.name) + '</span>' +
                            '<button type="button" onclick="logoutCascadingUser()" ' +
                                'style="padding:5px 12px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Logout</button>' +
                        '</div>' +
                        (field.showHierarchy !== false && hierarchyRows
                            ? '<div style="background:white;border-radius:6px;padding:10px;">' + hierarchyRows + '</div>' : '') +
                        '<input type="hidden" name="' + field.name + '" value="' + _esc(user.username) + '">' +
                    '</div>' +
                    '</div>';
            }

            var noUsers = !window.cascadingUserData ||
                          !window.cascadingUserData.users ||
                           window.cascadingUserData.users.length === 0;

            return '<div class="viewer-field" data-field-name="' + field.name + '">' +
                '<label class="viewer-field-label">' + _esc(field.label) + '</label>' +
                '<div style="background:#f8f9fa;border:2px solid #dee2e6;border-radius:8px;padding:15px;">' +

                (noUsers
                    ? '<div style="background:#fff3cd;padding:10px;border-radius:6px;font-size:12px;color:#856404;margin-bottom:12px;">' +
                      '&#9888; No users loaded. Upload users Excel in the form builder.</div>'
                    : '') +

                '<div style="margin-bottom:10px;">' +
                    '<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">Username</label>' +
                    '<input type="text" id="sfgCUUser_' + field.id + '" placeholder="Enter your username" ' +
                        'onkeydown="if(event.key===\'Enter\') sfgCULogin(\'' + field.id + '\')" ' +
                        'style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:6px;font-family:\'Oswald\',sans-serif;font-size:13px;box-sizing:border-box;">' +
                '</div>' +

                '<div style="margin-bottom:12px;">' +
                    '<label style="display:block;font-size:11px;font-weight:700;color:#555;text-transform:uppercase;margin-bottom:4px;">Password</label>' +
                    '<input type="password" id="sfgCUPass_' + field.id + '" placeholder="Enter your password" ' +
                        'onkeydown="if(event.key===\'Enter\') sfgCULogin(\'' + field.id + '\')" ' +
                        'style="width:100%;padding:10px 12px;border:2px solid #dee2e6;border-radius:6px;font-family:\'Oswald\',sans-serif;font-size:13px;box-sizing:border-box;">' +
                '</div>' +

                '<button type="button" onclick="sfgCULogin(\'' + field.id + '\')" ' +
                    'style="width:100%;padding:12px;background:#004080;color:white;border:none;border-radius:6px;cursor:pointer;font-family:\'Oswald\',sans-serif;font-weight:700;font-size:14px;">' +
                    _esc(field.loginText || 'Login') + '</button>' +

                '<div id="sfgCUMsg_' + field.id + '" style="margin-top:8px;font-size:12px;display:none;padding:8px;border-radius:4px;"></div>' +
                '<input type="hidden" name="' + field.name + '" id="sfgCUHidden_' + field.id + '">' +
                '</div>' +
                '</div>';
        };

        // New login handler using text input
        window.sfgCULogin = function (fieldId) {
            var usernameInput = document.getElementById('sfgCUUser_' + fieldId);
            var passwordInput = document.getElementById('sfgCUPass_' + fieldId);
            var msg           = document.getElementById('sfgCUMsg_' + fieldId);
            var hiddenInput   = document.getElementById('sfgCUHidden_' + fieldId);
            if (!usernameInput || !passwordInput) return;

            var username = usernameInput.value.trim();
            var password = passwordInput.value.trim();

            if (!username || !password) {
                _showMsg(msg, 'Please enter both username and password.', 'error'); return;
            }

            var users = (window.cascadingUserData && window.cascadingUserData.users) || [];
            var matched = null;
            for (var i = 0; i < users.length; i++) {
                if (users[i].username.toLowerCase() === username.toLowerCase() &&
                    users[i].password === password) {
                    matched = users[i]; break;
                }
            }

            if (!matched) {
                _showMsg(msg, '\u2717 Invalid username or password.', 'error');
                var box = usernameInput.closest('div[style*="background:#f8f9fa"]');
                if (box) {
                    box.style.borderColor = '#dc3545';
                    setTimeout(function () { box.style.borderColor = '#dee2e6'; }, 1500);
                }
                return;
            }

            window.cascadingUserData.currentUser = matched;
            if (hiddenInput) hiddenInput.value = matched.username;

            try {
                localStorage.setItem('cascadingUsers', JSON.stringify({
                    users: window.cascadingUserData.users,
                    hierarchyColumns: window.cascadingUserData.hierarchyColumns,
                    currentUser: matched
                }));
            } catch (e) {}

            _showMsg(msg, '\u2713 Welcome, ' + matched.name + '!', 'success');

            setTimeout(function () {
                if (typeof renderFormViewer === 'function') renderFormViewer();
                setTimeout(function () {
                    document.querySelectorAll('.sfg-validate-err').forEach(function (el) { el.remove(); });
                }, 200);
            }, 500);
        };

        window.loginCascadingUser = window.sfgCULogin;

        console.log('\u2705 ICF Collect Combined Plugin v1.0 ready');
    }

    // ============================================================
    // PART 5 — CREDENTIALS PANEL
    // ============================================================
    window.renderCredentialsPanel = function () {
        var panel = document.getElementById('credentialsPanel');
        if (!panel) return;
        try {
            window.formCredentials = JSON.parse(localStorage.getItem('icfFormCredentials') || '[]');
        } catch (e) { window.formCredentials = []; }

        panel.innerHTML =
            '<div style="margin-top:5px;">' +
            '<div style="font-size:11px;font-weight:700;color:#004080;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">&#128274; Form Access Credentials</div>' +
            '<p style="font-size:11px;color:#666;margin:0 0 10px;">Users must log in before accessing the shared form. Leave empty for open access.</p>' +
            '<div id="sfgCredList" style="margin-bottom:10px;"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end;">' +
              '<div>' +
                '<label style="font-size:10px;color:#555;display:block;margin-bottom:3px;font-weight:700;text-transform:uppercase;">Username</label>' +
                '<input type="text" id="sfgNewUser" placeholder="e.g. john_doe" style="width:100%;padding:7px 9px;border:1px solid #ccc;border-radius:4px;font-family:\'Oswald\',sans-serif;font-size:12px;box-sizing:border-box;">' +
              '</div>' +
              '<div>' +
                '<label style="font-size:10px;color:#555;display:block;margin-bottom:3px;font-weight:700;text-transform:uppercase;">Password</label>' +
                '<input type="password" id="sfgNewPass" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style="width:100%;padding:7px 9px;border:1px solid #ccc;border-radius:4px;font-family:\'Oswald\',sans-serif;font-size:12px;box-sizing:border-box;">' +
              '</div>' +
              '<button onclick="sfgAddCredential()" style="padding:7px 12px;background:#004080;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:\'Oswald\',sans-serif;font-weight:700;font-size:12px;height:32px;align-self:end;">+ Add</button>' +
            '</div>' +
            '<div id="sfgCredMsg" style="font-size:11px;margin-top:5px;display:none;"></div>' +
            '</div>';

        _sfgRenderCredList();
    };

    function _sfgRenderCredList() {
        var list = document.getElementById('sfgCredList');
        if (!list) return;
        if (!window.formCredentials || window.formCredentials.length === 0) {
            list.innerHTML = '<p style="font-size:11px;color:#aaa;font-style:italic;margin:0;">No credentials set \u2014 form is open access.</p>';
            return;
        }
        list.innerHTML = window.formCredentials.map(function (cred, i) {
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f0f5ff;border:1px solid #c5d8f5;border-radius:4px;margin-bottom:5px;">' +
                '<div><span style="font-weight:700;font-size:12px;color:#004080;">' + _esc(cred.username) + '</span>' +
                '<span style="font-size:10px;color:#888;margin-left:8px;">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span></div>' +
                '<button onclick="sfgRemoveCredential(' + i + ')" style="background:none;border:none;color:#cc0000;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">\u00d7</button>' +
                '</div>';
        }).join('');
    }

    window.sfgAddCredential = function () {
        var u = document.getElementById('sfgNewUser');
        var p = document.getElementById('sfgNewPass');
        var m = document.getElementById('sfgCredMsg');
        var username = u.value.trim(), password = p.value.trim();
        if (!username || !password) {
            m.textContent = 'Both fields required.'; m.style.color = 'red'; m.style.display = 'block'; return;
        }
        if (window.formCredentials.some(function (c) { return c.username.toLowerCase() === username.toLowerCase(); })) {
            m.textContent = 'Username already exists.'; m.style.color = 'red'; m.style.display = 'block'; return;
        }
        window.formCredentials.push({ username: username, password: password });
        localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials));
        u.value = ''; p.value = '';
        m.textContent = '\u2713 "' + username + '" added.'; m.style.color = 'green'; m.style.display = 'block';
        setTimeout(function () { m.style.display = 'none'; }, 2500);
        _sfgRenderCredList();
        if (typeof notify === 'function') notify('Credential "' + username + '" added', 'success');
    };

    window.sfgRemoveCredential = function (i) {
        if (!confirm('Remove user "' + window.formCredentials[i].username + '"?')) return;
        window.formCredentials.splice(i, 1);
        localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials));
        _sfgRenderCredList();
    };

    // ============================================================
    // PART 6 — SHARED FORM LOGIN GATE
    // ============================================================
    window.sfgLogin = function () {
        var username = document.getElementById('sfgUsername').value.trim();
        var password = document.getElementById('sfgPassword').value.trim();
        var msg      = document.getElementById('sfgMsg');
        if (!username || !password) {
            msg.textContent = 'Please enter both username and password.'; msg.className = 'sfg-msg error'; return;
        }
        var creds = window._sfgCredentials || [];
        var match = null;
        for (var i = 0; i < creds.length; i++) {
            if (creds[i].username.toLowerCase() === username.toLowerCase() && creds[i].password === password) {
                match = creds[i]; break;
            }
        }
        if (!match) {
            msg.textContent = '\u2717 Invalid username or password.'; msg.className = 'sfg-msg error';
            var card = document.querySelector('.sfg-card');
            if (card) { card.classList.add('sfg-shake'); setTimeout(function () { card.classList.remove('sfg-shake'); }, 500); }
            return;
        }
        msg.textContent = '\u2713 Welcome, ' + match.username + '!'; msg.className = 'sfg-msg success';
        setTimeout(function () {
            document.getElementById('sharedFormLoginGate').classList.remove('show');
            document.getElementById('viewerContainer').classList.add('show');
        }, 600);
    };

    // ============================================================
    // UTILITIES
    // ============================================================
    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _showMsg(el, text, type) {
        if (!el) return;
        el.textContent = text; el.style.display = 'block';
        if (type === 'error') {
            el.style.background = '#fff0f0'; el.style.color = '#cc0000'; el.style.border = '1px solid #ffcccc';
        } else {
            el.style.background = '#f0fff4'; el.style.color = '#155724'; el.style.border = '1px solid #c3e6cb';
        }
    }

})();
