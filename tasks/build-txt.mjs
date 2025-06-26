import fs from 'fs';
import path from 'path';

const packageJson = JSON.parse(fs.readFileSync(path.resolve('./package.json')), 'utf-8');

const { version } = packageJson;

const PATH = './dist';
const FILENAME = 'build.txt';

const main = () => {
    const content = `version=${version}`;
    const dir = path.resolve(PATH);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    fs.writeFileSync(path.resolve(PATH, FILENAME), content);
};

main();
