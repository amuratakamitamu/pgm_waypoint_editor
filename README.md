# Waypoint Studio

PGM マップ上に ROS 2 の waypoint を配置し、YAML として書き出すための Next.js アプリケーションです。

## 起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開き、PGM と対応する map YAML を選択してください。

Google Maps から衛星画像を取得する場合は、Maps Static API を有効化したAPIキーを `.env.local` に設定します。

```env
GOOGLE_MAPS_API_KEY=your_api_key_here
```

`.env.example` も設定例として利用できます。APIキーはサーバー側だけで使用され、ブラウザには公開されません。

## 使い方

1. `PGM ファイルを選択` と `map YAML を選択` から地図を読み込みます。
2. 続きから編集する場合は、`Waypoint file` から作成済みの `waypoints.yaml` を読み込みます。
3. 必要に応じて `Satellite overlay` に緯度・経度・ズームを入力してGoogle Mapsから取得するか、PNG / JPEG / WebP の画像を選択します。
4. 透明度、X/Y オフセット、拡大率、回転角を調整して PGM に重ねます。`ドラッグで位置合わせ` を有効にすると、プレビュー上でも画像を移動できます。
5. 位置合わせを終了し、地図をクリックしてそのままドラッグすることで地点と向きを指定します。
6. `YAML をダウンロード` を押すと `waypoints.yaml` を取得できます。

map YAML の `resolution` と `origin: [x, y, yaw]` を座標変換に用います。出力する姿勢は指定されたヨー角からクォータニオンに変換されます。

waypoints YAML は、このアプリが出力する `waypoints` 配列のほか、`poses` 配列および `pose.position` / `pose.orientation` 形式も読み込めます。読み込んだクォータニオンからヨー角を復元します。

衛星画像はブラウザ内でのみ読み込まれ、サーバーへ送信されません。画像の位置合わせ情報は現在のセッション内だけで保持されます。
