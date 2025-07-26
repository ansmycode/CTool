export const MVMZ_SERVICE_URL = 'http://localhost:5000';

// 定义获取游戏数据的函数
export const getGameData = async () => {
  try {
    const response = await fetch(`${MVMZ_SERVICE_URL}/getGameData`); // 使用 fetch 请求 API
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json(); // 获取 JSON 数据
    return data;
  } catch (error) {
    console.error('API 请求失败:', error);
    throw error; // 抛出异常
  }
};
