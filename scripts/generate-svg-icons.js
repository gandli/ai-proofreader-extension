import fs from 'fs';
import path from 'path';

const SIZES = [16, 24, 32, 48, 72, 96, 128];
const SVG_SOURCE = 'public/icon.svg';
const OUTPUT_DIR = 'public/icons';

function generateSvgIcons() {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const svgContent = fs.readFileSync(SVG_SOURCE, 'utf-8');

    for (const size of SIZES) {
        const svgPath = path.join(OUTPUT_DIR, `icon-${size}.svg`);
        // Replace width and height attributes in the root <svg> tag
        let resizedSvg = svgContent.replace(/<svg[^>]*width="[^"]*"/, `<svg width="${size}"`);
        resizedSvg = resizedSvg.replace(/<svg[^>]*height="[^"]*"/, `<svg height="${size}"`);

        fs.writeFileSync(svgPath, resizedSvg);
        console.log(`Generated: ${svgPath}`);
    }
}

generateSvgIcons();
