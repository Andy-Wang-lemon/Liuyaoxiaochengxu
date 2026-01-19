import crypto from "crypto";
import fs from "fs";
import path from "path";
import axios from "axios";
// 微信支付配置
const config = {
    appid: process.env.WECHAT_APPID || "",
    mchid: process.env.WECHAT_MCHID || "",
    serialNo: process.env.WECHAT_SERIAL_NO || "",
    apiv3Key: process.env.WECHAT_APIV3_KEY || "",
    notifyUrl: process.env.WECHAT_NOTIFY_URL || "",
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || "./certs/apiclient_key.pem",
    publicKeyPath: process.env.WECHAT_PUBLIC_KEY_PATH || "./certs/apiclient_cert.pem",
};
// 微信支付API基础URL
const WECHAT_PAY_API = "https://api.mch.weixin.qq.com";
/**
 * 生成签名
 */
function generateSignature(method, url, timestamp, nonceStr, body) {
    const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
    try {
        const privateKeyPath = path.resolve(process.cwd(), config.privateKeyPath);
        const privateKey = fs.readFileSync(privateKeyPath, "utf8");
        const sign = crypto.createSign("RSA-SHA256");
        sign.update(message);
        return sign.sign(privateKey, "base64");
    }
    catch (error) {
        console.error("生成签名失败:", error);
        throw new Error("微信支付签名失败");
    }
}
/**
 * 生成Authorization头
 */
function generateAuthorizationHeader(method, url, body) {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = crypto.randomBytes(16).toString("hex");
    const signature = generateSignature(method, url, timestamp, nonceStr, body);
    return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${config.serialNo}"`;
}
/**
 * 创建Native支付订单（生成二维码）
 */
export async function createNativePayment(orderId, amount, description) {
    const url = "/v3/pay/transactions/native";
    const fullUrl = `${WECHAT_PAY_API}${url}`;
    const body = {
        appid: config.appid,
        mchid: config.mchid,
        description: description,
        out_trade_no: orderId,
        notify_url: config.notifyUrl,
        amount: {
            total: amount, // 单位：分
            currency: "CNY",
        },
    };
    const bodyStr = JSON.stringify(body);
    const authorization = generateAuthorizationHeader("POST", url, bodyStr);
    try {
        const response = await axios.post(fullUrl, body, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: authorization,
            },
        });
        return {
            code_url: response.data.code_url,
            orderId: orderId,
        };
    }
    catch (error) {
        console.error("创建微信支付订单失败:", error.response?.data || error.message);
        throw new Error("创建支付订单失败");
    }
}
/**
 * 查询订单状态
 */
export async function queryOrder(orderId) {
    const url = `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${config.mchid}`;
    const fullUrl = `${WECHAT_PAY_API}${url}`;
    const authorization = generateAuthorizationHeader("GET", url, "");
    try {
        const response = await axios.get(fullUrl, {
            headers: {
                Accept: "application/json",
                Authorization: authorization,
            },
        });
        return response.data;
    }
    catch (error) {
        console.error("查询订单失败:", error.response?.data || error.message);
        throw new Error("查询订单失败");
    }
}
/**
 * 验证微信支付回调签名
 */
export function verifyNotifySignature(timestamp, nonce, body, signature, serialNo) {
    try {
        const message = `${timestamp}\n${nonce}\n${body}\n`;
        const publicKeyPath = path.resolve(process.cwd(), config.publicKeyPath);
        const publicKey = fs.readFileSync(publicKeyPath, "utf8");
        const verify = crypto.createVerify("RSA-SHA256");
        verify.update(message);
        return verify.verify(publicKey, signature, "base64");
    }
    catch (error) {
        console.error("验证签名失败:", error);
        return false;
    }
}
/**
 * 解密微信支付回调数据
 */
export function decryptNotifyData(ciphertext, associatedData, nonce) {
    try {
        const key = Buffer.from(config.apiv3Key, "utf8");
        const iv = Buffer.from(nonce, "utf8");
        const data = Buffer.from(ciphertext, "base64");
        // 提取tag和加密数据
        const authTag = data.slice(data.length - 16);
        const encryptedData = data.slice(0, data.length - 16);
        // 解密
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        decipher.setAAD(Buffer.from(associatedData, "utf8"));
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString("utf8"));
    }
    catch (error) {
        console.error("解密回调数据失败:", error);
        throw new Error("解密失败");
    }
}
/**
 * 检查微信支付配置是否完整
 */
export function checkWechatPayConfig() {
    if (!config.appid || !config.mchid || !config.serialNo || !config.apiv3Key) {
        console.warn("微信支付配置不完整，请检查环境变量");
        return false;
    }
    try {
        const privateKeyPath = path.resolve(process.cwd(), config.privateKeyPath);
        const publicKeyPath = path.resolve(process.cwd(), config.publicKeyPath);
        if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
            console.warn("微信支付证书文件不存在");
            return false;
        }
    }
    catch (error) {
        console.warn("检查微信支付证书失败:", error);
        return false;
    }
    return true;
}
