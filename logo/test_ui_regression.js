const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
const indexHtmlPath = path.join(__dirname, 'index.html');
const stylesFixesCssPath = path.join(__dirname, 'styles_fixes.css');

function runTest() {
    console.log('Running UI Regression Test...');
    let errors = [];

    // 1. Verify app.js changes
    const appJsContent = fs.readFileSync(appJsPath, 'utf8');
    
    // Check for CustomTypeManager grid layout class
    if (!appJsContent.includes("rowDiv.className = 'ct-inputs-row'")) {
        errors.push("CustomTypeManager.renderEditForm missing 'ct-inputs-row' class");
    }

    // Check for modern button classes in CustomTypeManager
    if (!appJsContent.includes("doneBtn.className = 'btn-modern-primary'")) {
        errors.push("CustomTypeManager.renderEditForm missing 'btn-modern-primary' class");
    }

    // Check for renderSTEdit updates
    if (!appJsContent.includes("colorsDiv.className = 'ct-colors-grid'")) {
        errors.push("renderSTEdit missing 'ct-colors-grid' class");
    }
    if (!appJsContent.includes("createColorPicker('Fondo', 'bg', '#eee')")) {
        errors.push("renderSTEdit missing modern createColorPicker implementation");
    }

    // Check for Modular UI Component usage
    if (!appJsContent.includes("UIComponents.PersonalActions.render")) {
        errors.push("renderPersonalList missing 'UIComponents.PersonalActions.render' usage");
    }

    // 2. Verify index.html changes
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

    // Check for ui_components.js include
    if (!indexHtmlContent.includes('<script src="ui_components.js"></script>')) {
        errors.push("index.html missing 'ui_components.js' script tag");
    }

    // Check for L-V/SADOFE toggle classes
    if (!indexHtmlContent.includes('class="selection-btn-group"')) {
        errors.push("index.html missing 'selection-btn-group' container");
    }
    if (!indexHtmlContent.includes('class="btn-selection" id="preset-sadofe"')) {
        errors.push("index.html missing 'btn-selection' class for SADOFE button");
    }

    // Check for Add Personal modal buttons
    if (!indexHtmlContent.includes('class="btn-modern-secondary" id="cancel-btn"')) {
        errors.push("index.html missing 'btn-modern-secondary' for cancel button");
    }

    // 3. Verify styles_fixes.css existence and key classes
    const stylesFixesContent = fs.readFileSync(stylesFixesCssPath, 'utf8');
    
    if (!stylesFixesContent.includes('.ct-inputs-row')) {
        errors.push("styles_fixes.css missing '.ct-inputs-row'");
    }
    if (!stylesFixesContent.includes('.btn-modern-primary')) {
        errors.push("styles_fixes.css missing '.btn-modern-primary'");
    }
    if (!stylesFixesContent.includes('.selection-btn-group')) {
        errors.push("styles_fixes.css missing '.selection-btn-group'");
    }

    if (errors.length > 0) {
        console.error('Regression Test FAILED:');
        errors.forEach(e => console.error(`- ${e}`));
        process.exit(1);
    } else {
        console.log('Regression Test PASSED: All UI components are correctly implemented.');
    }
}

try {
    runTest();
} catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
}
