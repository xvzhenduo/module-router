import { defineConfig } from "eslint/config";
import nodePlugin from "eslint-plugin-n";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["node_modules", "**/__tests__/**"],
  },
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      n: nodePlugin,
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      //禁用过时语法
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "always"], //强制 ===
      "no-eval": "error",
      "@typescript-eslint/no-deprecated": "error", //禁止已弃用的api
      //限制代码复杂度
      complexity: ["error", { max: 10 }], //分支不超过 10 个
      "max-lines-per-function": [
        "warn",
        {
          max: 80,
          skipBlankLines: true, //跳过空行
          skipComments: true, //跳过注释
        },
      ], //函数不超过80行
      "max-depth": ["error", 4], //嵌套不超过 4 层
      "max-lines": [
        "error",
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true,
        }, //文件不超过300行
      ],
      //强制严格类型
      "@typescript-eslint/no-explicit-any": "error", //禁用any
      "@typescript-eslint/no-unsafe-assignment": "warn", //禁止any赋值
      "@typescript-eslint/no-unsafe-member-access": "warn", //拦截虚构属性调用
      //import
      "simple-import-sort/imports": "error", // import排序
      "simple-import-sort/exports": "off", // export排序
      "unused-imports/no-unused-imports": "error", //未使用的import
      //死代码
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-unreachable": "error",
      //node
      "n/no-sync": ["error", { allowAtRootLevel: true }], //禁止非顶层同步api
      "n/no-deprecated-api": "error", //禁用废弃API
      "n/prefer-promises/fs": "error", //强制使用fs.promises
      "n/prefer-promises/dns": "error", //强制使用dns.promises
      "n/prefer-global/process": ["error", "always"],
      "n/prefer-global/buffer": ["error", "always"],
      "n/prefer-global/url": ["error", "always"], // 强制使用全局 URL
      "n/prefer-global/url-search-params": ["error", "always"], // 强制使用全局 URLSearchParams
      "n/prefer-global/text-decoder": ["error", "always"], // 强制使用全局 TextDecoder
      "n/prefer-global/text-encoder": ["error", "always"], // 强制使用全局 TextEncoder
      "n/no-path-concat": "error", // 禁止手动拼接路径
      "n/no-process-exit": "warn",
      "no-console": "error",
    },
  },
]);
