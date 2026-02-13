import { expect, test, describe } from "bun:test";
import { getSystemPrompt } from "./prompts";

describe("getSystemPrompt", () => {
    test("should return summarize prompt", () => {
        const settings = { extensionLanguage: "English" };
        const prompt = getSystemPrompt("summarize", settings);
        expect(prompt).toContain("你是一个摘要提取工具");
        expect(prompt).toContain("直接且仅输出 English 结果文本：");
    });

    test("should return correct prompt", () => {
        const settings = { extensionLanguage: "中文" };
        const prompt = getSystemPrompt("correct", settings);
        expect(prompt).toContain("你是一个文本校对助手");
        expect(prompt).toContain("直接且仅输出 中文 结果文本：");
    });

    test("should return proofread prompt with professional tone", () => {
        const settings = { tone: "professional", extensionLanguage: "中文" };
        const prompt = getSystemPrompt("proofread", settings);
        expect(prompt).toContain("你是一个文字润色编辑");
        expect(prompt).toContain("语气：专业且正式");
    });

    test("should return proofread prompt with casual tone", () => {
        const settings = { tone: "casual", extensionLanguage: "中文" };
        const prompt = getSystemPrompt("proofread", settings);
        expect(prompt).toContain("语气：轻松且口语化");
    });

    test("should return translate prompt with academic tone", () => {
        const settings = { tone: "academic", extensionLanguage: "日本語" };
        const prompt = getSystemPrompt("translate", settings);
        expect(prompt).toContain("你是一个专业翻译官");
        expect(prompt).toContain("语气：学术且严谨");
        expect(prompt).toContain("直接且仅输出 日本語 结果文本：");
    });

    test("should return expand prompt with creative detail", () => {
        const settings = { detailLevel: "creative", extensionLanguage: "中文" };
        const prompt = getSystemPrompt("expand", settings);
        expect(prompt).toContain("你是一个内容扩写专家");
        expect(prompt).toContain("详细度：充满创意与文学性");
    });

    test("should fallback to proofread for unknown mode", () => {
        const prompt = getSystemPrompt("unknown", {});
        expect(prompt).toContain("你是一个文字润色编辑");
    });

    test("should handle missing settings", () => {
        const prompt = getSystemPrompt("summarize", null);
        expect(prompt).toContain("你是一个摘要提取工具");
        expect(prompt).toContain("直接且仅输出 中文 结果文本：");
    });

    test("should handle partial settings", () => {
        const prompt = getSystemPrompt("proofread", { tone: "concise" });
        expect(prompt).toContain("语气：极其简练");
        expect(prompt).toContain("直接且仅输出 中文 结果文本：");
    });

    test("should include strict constraints in all prompts", () => {
        const prompt = getSystemPrompt("summarize", {});
        expect(prompt).toContain("绝对禁止输出任何引言");
        expect(prompt).toContain("【注意】：严禁废话，不准解释，只返回处理后的内容。");
    });
});
