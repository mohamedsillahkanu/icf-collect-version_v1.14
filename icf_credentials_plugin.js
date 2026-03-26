/**
 * ICF Collect — Cascadeuser Validation Fix
 * Add this before </script> in your HTML, OR append to icf_credentials_plugin.js
 *
 * Fixes: cascadeuser field incorrectly fails required validation,
 *        blocking goToNextPage even when user is logged in.
 */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {

            var _origValidate = window.validateCurrentPage;
            if (typeof _origValidate !== 'function') return;

            window.validateCurrentPage = function (currentPageIndex) {
                var currentPageEl = document.querySelector('.form-page[data-page="' + currentPageIndex + '"]');
                if (!currentPageEl) return true;

                // For cascadeuser fields on this page:
                // If the user has logged in  → hidden input has a value → pass
                // If the user has NOT logged → hidden input is empty    → fail with clear message
                var allFieldEls = currentPageEl.querySelectorAll('.viewer-field');
                for (var i = 0; i < allFieldEls.length; i++) {
                    var fieldEl = allFieldEls[i];
                    if (fieldEl.classList.contains('field-hidden')) continue;

                    var fieldName = fieldEl.dataset.fieldName;
                    if (!fieldName) continue;

                    var fieldDef = (window.state && window.state.fields)
                        ? window.state.fields.find(function (f) { return f.name === fieldName; })
                        : null;

                    if (!fieldDef || fieldDef.type !== 'cascadeuser') continue;
                    if (!fieldDef.required) continue;

                    // Check the hidden input that stores the logged-in username
                    var hiddenInput = fieldEl.querySelector('input[type="hidden"][name="' + fieldName + '"]');
                    var val = hiddenInput ? hiddenInput.value.trim() : '';

                    if (!val) {
                        // User hasn't logged in — show a helpful message and block
                        var existingErr = fieldEl.querySelector('.sfg-validate-err');
                        if (!existingErr) {
                            var errDiv = document.createElement('div');
                            errDiv.className = 'sfg-validate-err';
                            errDiv.style.cssText = 'color:#dc3545;font-size:12px;margin-top:6px;padding:6px 10px;background:#fff5f5;border-radius:4px;border-left:3px solid #dc3545;';
                            errDiv.textContent = '\u26a0 Please log in to continue.';
                            fieldEl.appendChild(errDiv);
                        }
                        fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        if (typeof notify === 'function') notify('Please log in to the user field before continuing', 'error');
                        return false;
                    } else {
                        // Logged in — clear any previous error
                        var prev = fieldEl.querySelector('.sfg-validate-err');
                        if (prev) prev.remove();
                    }
                }

                // Run original validation for all other field types
                return _origValidate.apply(this, arguments);
            };

            // Also clear the error message once the user logs in
            var _origLogin = window.loginCascadingUser;
            if (typeof _origLogin === 'function') {
                window.loginCascadingUser = function (fieldId) {
                    _origLogin.apply(this, arguments);
                    // Remove validation error if it was shown
                    setTimeout(function () {
                        document.querySelectorAll('.sfg-validate-err').forEach(function (el) {
                            el.remove();
                        });
                    }, 200);
                };
            }

            console.log('\u2705 Cascadeuser validation fix applied');

        }, 500);
    });

})();
