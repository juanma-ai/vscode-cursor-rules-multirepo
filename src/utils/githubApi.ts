import axios from 'axios';
import * as fs from 'fs';

export interface Rule {
    name: string;
    download_url: string;
}

const REPO_API_URL = 'https://api.github.com/repos/PatrickJS/awesome-cursorrules/contents/rules';

export async function fetchCursorRulesList(): Promise<Rule[]> {
    const response = await axios.get(REPO_API_URL);
    return response.data.map((file: any) => ({
        name: file.name,
        download_url: file.download_url
    }));
}

export async function fetchCursorRuleContent(ruleName: string, filePath: string, onProgress: (progress: number) => void): Promise<void> {
    const url = `${REPO_API_URL}/${ruleName}/.cursorrules`;
    const initialResponse = await axios.get(url);
    const downloadUrl = initialResponse.data.download_url;

    const response = await axios.get(downloadUrl, { responseType: 'stream' });

    const totalLength = parseInt(response.headers['content-length'], 10);
    let downloaded = 0;

    const writer = fs.createWriteStream(filePath);

    response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalLength) {
            const progress = (downloaded / totalLength) * 100;
            onProgress(Math.round(progress));
        }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
} 