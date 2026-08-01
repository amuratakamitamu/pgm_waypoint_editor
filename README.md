# Waypoint Studio

PGM マップ上に ROS 2 の waypoint を配置し、YAML として書き出すための Next.js アプリケーションです。

## 起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開き、PGM と対応する map YAML を選択してください。

## 使い方

1. `PGM ファイルを選択` と `map YAML を選択` から地図を読み込みます。
2. 地図をクリックし、そのままドラッグして地点と向きを指定します。
3. `YAML をダウンロード` を押すと `waypoints.yaml` を取得できます。

map YAML の `resolution` と `origin: [x, y, yaw]` を座標変換に用います。出力する姿勢は指定されたヨー角からクォータニオンに変換されます。
