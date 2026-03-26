/**
 * ICF Collect — Credentials Plugin v2.1
 * =========================================
 * Fixes:
 *  - Cascade CORS error no longer blocks share URL generation
 *  - Credentials panel now reliably shows in builder
 *
 * INSTALL: One line before </body>:
 *   <script src="icf_credentials_plugin.js"></script>
 */

(function () {
    'use strict';

    // ==================== CSS ====================
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
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);

    // ==================== STATE ====================
    window.formCredentials = [];

    // ==================== INJECT HTML + HOOK FUNCTIONS ====================
    document.addEventListener('DOMContentLoaded', function () {

        // --- Login gate before notification div ---
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

        // --- Credentials panel div inside properties panel ---
        var propsPanel = document.getElementById('propertiesPanel');
        if (propsPanel && !document.getElementById('credentialsPanel')) {
            var cpDiv = document.createElement('div');
            cpDiv.id = 'credentialsPanel';
            propsPanel.appendChild(cpDiv);
        }

        // --- shareNote after qr-actions in share modal ---
        var qrActions = document.querySelector('#shareModal .qr-actions');
        if (qrActions && !document.getElementById('shareNote')) {
            var noteP = document.createElement('p');
            noteP.id = 'shareNote';
            qrActions.after(noteP);
        }

        // --- Hook functions after app scripts have run ---
        setTimeout(_hookAppFunctions, 400);
    });

    // ==================== HOOK APP FUNCTIONS ====================
    function _hookAppFunctions() {

        // FIX 1: Patch saveCascadeDataToCloud so CORS failures are silent warnings,
        //         not hard errors that abort the share process.
        if (typeof window.saveCascadeDataToCloud === 'function') {
            var _origSave = window.saveCascadeDataToCloud;
            window.saveCascadeDataToCloud = async function (cascadeId, compressedData, columns) {
                try {
                    return await _origSave.apply(this, arguments);
                } catch (err) {
                    // Log but do NOT re-throw — cascade cloud save failure should
                    // not block URL generation.
                    console.warn('[ICF Plugin] Cascade cloud save failed (non-fatal):', err.message);
                    if (typeof notify === 'function') {
                        notify('Cascade save skipped (CORS) — link still works if recipients are online', 'warning');
                    }
                    return false; // signal failure without throwing
                }
            };
        }

        // FIX 2: Hook shareForm — inject credentials into payload via pako intercept
        var _origShare = window.shareForm;
        if (typeof _origShare === 'function') {
            window.shareForm = async function () {
                // Load latest credentials
                try {
                    window.formCredentials = JSON.parse(localStorage.getItem('icfFormCredentials') || '[]');
                } catch (e) { window.formCredentials = []; }

                // Intercept pako.deflate for exactly ONE call to inject creds
                if (window.pako && typeof window.pako.deflate === 'function') {
                    var _origDeflate = window.pako.deflate;
                    window.pako.deflate = function (data) {
                        window.pako.deflate = _origDeflate; // restore immediately
                        try {
                            var parsed = JSON.parse(data);
                            if (parsed && parsed.s) {
                                parsed.s.creds = window.formCredentials;
                            }
                            return _origDeflate(JSON.stringify(parsed));
                        } catch (e) {
                            return _origDeflate(data);
                        }
                    };
                }

                await _origShare.apply(this, arguments);

                // Update share note
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

        // FIX 3: Hook renderSharedForm — show login gate if creds present
        var _origRender = window.renderSharedForm;
        if (typeof _origRender === 'function') {
            window.renderSharedForm = async function (data) {
                var embeddedCreds = (data && data.s && data.s.creds) ? data.s.creds : [];

                if (embeddedCreds.length > 0) {
                    window._sfgCredentials = embeddedCreds;

                    // Set title
                    var titleEl = document.getElementById('sfgFormTitle');
                    if (titleEl) titleEl.textContent = (data.s && data.s.t) ? data.s.t : 'Form';

                    // Hide shell
                    var header   = document.querySelector('.header');
                    var footer   = document.querySelector('.footer');
                    var authCont = document.getElementById('authContainer');
                    var mainCont = document.getElementById('mainContainer');
                    if (header)   header.style.display  = 'none';
                    if (footer)   footer.style.display  = 'none';
                    if (authCont) authCont.style.display = 'none';
                    if (mainCont) mainCont.classList.remove('show');

                    // Show login gate
                    var gate = document.getElementById('sharedFormLoginGate');
                    if (gate) gate.classList.add('show');

                    // Suppress viewerContainer.show until login succeeds
                    var vc = document.getElementById('viewerContainer');
                    if (vc) {
                        var _origAdd = vc.classList.add.bind(vc.classList);
                        vc.classList.add = function (cls) {
                            if (cls === 'show') {
                                vc.classList.add = _origAdd; // restore
                                return;
                            }
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

        // FIX 4: Hook showBuilder so credentials panel renders when builder opens
        var _origShowBuilder = window.showBuilder;
        if (typeof _origShowBuilder === 'function') {
            window.showBuilder = function () {
                _origShowBuilder.apply(this, arguments);
                setTimeout(window.renderCredentialsPanel, 100);
            };
        }

        // Also render panel immediately if builder is already visible
        var mc = document.getElementById('mainContainer');
        if (mc && mc.classList.contains('show')) {
            setTimeout(window.renderCredentialsPanel, 100);
        }

        console.log('\u2705 ICF Credentials Plugin v2.1 ready');
    }

    // ==================== CREDENTIALS PANEL ====================
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
        var userInput = document.getElementById('sfgNewUser');
        var passInput = document.getElementById('sfgNewPass');
        var msg       = document.getElementById('sfgCredMsg');
        var username  = userInput.value.trim();
        var password  = passInput.value.trim();

        if (!username || !password) {
            msg.textContent = 'Both username and password are required.';
            msg.style.color = 'red'; msg.style.display = 'block'; return;
        }
        if (window.formCredentials.some(function (c) {
            return c.username.toLowerCase() === username.toLowerCase();
        })) {
            msg.textContent = 'Username already exists.';
            msg.style.color = 'red'; msg.style.display = 'block'; return;
        }
        window.formCredentials.push({ username: username, password: password });
        localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials));
        userInput.value = ''; passInput.value = '';
        msg.textContent = '\u2713 "' + username + '" added.';
        msg.style.color = 'green'; msg.style.display = 'block';
        setTimeout(function () { msg.style.display = 'none'; }, 2500);
        _sfgRenderCredList();
        if (typeof notify === 'function') notify('Credential "' + username + '" added', 'success');
    };

    window.sfgRemoveCredential = function (index) {
        if (!confirm('Remove user "' + window.formCredentials[index].username + '"?')) return;
        window.formCredentials.splice(index, 1);
        localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials));
        _sfgRenderCredList();
    };

    // ==================== LOGIN GATE ====================
    window.sfgLogin = function () {
        var username = document.getElementById('sfgUsername').value.trim();
        var password = document.getElementById('sfgPassword').value.trim();
        var msg      = document.getElementById('sfgMsg');

        if (!username || !password) {
            msg.textContent = 'Please enter both username and password.';
            msg.className = 'sfg-msg error'; return;
        }
        var creds = window._sfgCredentials || [];
        var match = null;
        for (var i = 0; i < creds.length; i++) {
            if (creds[i].username.toLowerCase() === username.toLowerCase() && creds[i].password === password) {
                match = creds[i]; break;
            }
        }
        if (!match) {
            msg.textContent = '\u2717 Invalid username or password.';
            msg.className = 'sfg-msg error';
            var card = document.querySelector('.sfg-card');
            if (card) {
                card.classList.add('sfg-shake');
                setTimeout(function () { card.classList.remove('sfg-shake'); }, 500);
            }
            return;
        }
        msg.textContent = '\u2713 Welcome, ' + match.username + '!';
        msg.className = 'sfg-msg success';
        setTimeout(function () {
            document.getElementById('sharedFormLoginGate').classList.remove('show');
            document.getElementById('viewerContainer').classList.add('show');
        }, 600);
    };

    function _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

})();
