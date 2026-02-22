# エネルギー効率監視アプリケーション
以下の2つのマークダウンファイルは必ず先に参照すること
目的： ./goal.mdに書かれたハッカソンの目的を達成するウェブインターフェースを作る。
使用データの概要：./data-dictionary.md

すでにチームメンバーがデータに基づいて天候と建物情報から各Utility Typesごとのエネルギー使用料を予測する機械学習モデルを作成しています。
これを”平常値”を示す指標として使い、実際の値との差分を比較し、異常を検知します。

## Container
1. Backend(FastAPI)
2. Frontend(React + Vite + Typescript + tailwind + shadcn)

## 画面構成
admin dashboard形式のレイアウト

1. map overview
"mapcn"(https://mapcn.vercel.app/docs)を使い、インタラクティブな地図上で各建物の位置にエネルギー使用量とモデルによる予測値の差分スコア（異常）とアイコン（平常・注意・異常）を表示。クリックすることで2. Building detailページに移動できる。
画面上部のドロップダウンから、表示するUtility Typesを切り替えることができる。

リスト：
| Utility | Category | Description | Units |
|---|---|---|---|
| **ELECTRICITY** | Energy | Electrical energy consumption | kWh |
| **GAS** | Energy | Natural gas consumption | varies |
| **HEAT** | Energy | Thermal energy delivered for heating | varies |
| **STEAM** | Energy | Thermal energy delivered as steam | kg |
| **COOLING** | Energy | Thermal energy delivered for cooling | ton-hours |
| **COOLING_POWER** | Power | Instantaneous cooling demand | tons |
| **STEAMRATE** | Power | Instantaneous steam flow rate | varies |
| **OIL28SEC** | Energy | Fuel oil consumption | varies |

2. Building detail
建物に関する詳細ダッシュボード

要素：
各Utilityごとのエネルギー使用、モデルによる予測との差分
時系列の折れ線グラフ
他の重要指標

3. Upload New data
既存のデータと同じフォーマットの新しいデータを追加できる。csvアップロード、直接入力（1行ずつ）に対応
- 天気データ (公開されている天気APIから取得するオプションも用意)
- メーターデータ
- 建物データ

4. Chatbot
ChatGPTスタイル
データについて質問すると、LLMの回答を得ることができる。
Vercel AI SDKを使用してUIを作成する。

LLMのもつツール：
- Python実行
pythonコードを使用してデータの可視化や計算を実行できる。UIには実行したコードと結果を表示する。コードはBackend(FastAPI)コンテナで実行する。（LLMのコードを実行するのは危険だが、全てのアプリケーションは隔離された仮想マシンで動作することを前提とし、許容する）
- エネルギー使用料を予測する機械学習モデルの実行
「もしこの日の天気が〇〇だったらエネルギー使用量の予測はどうなるか」などの仮説検証を行うことができる。

## UI Design
Notionスタイルの高機能なデザイン
言語は全て英語

# 事前調査[完了]
詳細設計の作成前に事前調査を行う。結果は./pre-research内にマークダウンでそれぞれ保存する。
ドキュメント調査では、基本的な使用方法を網羅した上で今回の実装に必要となるところを深掘りする。

1. mapcn公式ドキュメントの調査
2. Vercel AI SDK公式ドキュメントの調査

# ui設計書の作成[完了]
uiを設計し、ui.spec.mdに記載する。
レイアウト設計、画面ごとのコンポーネント設計

# 設計書の構成
全ての設計書は/spec/に配置する。
設計書は以下の形式で配置する。
pre-researchの内容は他の設計書を書くときに参考にすること

spec/
 - overview.md ＃このファイル
 - data-dictionary.md # 使用するデータの形式を説明する (../data内のcsvに実際のデータがある)
 - goal.md #このプロジェクトの目的
 - model-reference.md # 予測モデルの使用に関するドキュメント
 - pre-research/
   - mapcn.md
   - vercel-ai-sdk.md
 - backend_services/ # 各サービスの詳細設計を配置する
 - directry.spec.md
 - backend.test.plan.md
 - ux.design.md
 - ui.design.md
 - api.spec.md
 - questions.md # 設計中に出現した不明点を記載する。まず現行の実装を詳しく調べそれに倣い、それでも不明な場合に書く。有効なオプションとそれぞれのアップサイド・ダウンサイドを記載する。
 - ideas.md # 設計中に出現したアイデアを記載する。

その他参照可能なディレクトリ
data/ #実際のデータ(csv)
model/model_best.json #予測に使用するモデル

# 注意：
サブエージェントを呼び出す際に、このspec-v2/overview.spec.mdは必ずコンテキストに含める。


# 実装
impl.mdに実装計画と各フェーズで参照すべき設計書が書いてあります。
実装時は、フェーズごとに内容のダブルチェック+他部分との整合性チェックを行なってください。
テストを行う際はpythonライブラリをホスト環境にインストールしないように注意してください。仮想環境を使ってください。