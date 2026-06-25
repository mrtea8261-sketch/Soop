# 숲 스트리머 거리 맞추기

GitHub Pages에서 무료로 올릴 수 있는 정적 웹 게임입니다.

## 기능

- 한국어 UI
- 두 스트리머 사이의 최단 연결 거리 맞추기
- 숫자를 누르면 실제 연결 경로가 애니메이션으로 표시됨
- 정답이면 +1점
- 오답이면 게임 종료
- 프로필 이미지 표시
- 로컬 TOP 5 리더보드
- Supabase 설정 시 전 세계 리더보드 사용 가능

## 파일 구조

```txt
index.html
style.css
app.js
supabase-config.js
data/soop_graph_undirected.json
supabase/schema.sql
README.md
```

## 로컬 테스트

```bash
python -m http.server 8000
```

또는 Windows에서:

```bash
py -m http.server 8000
```

그 다음 브라우저에서:

```txt
http://localhost:8000
```

Python이 없으면 VS Code Live Server로 `index.html`을 열어도 됩니다.

## GitHub Pages 업로드

1. GitHub에서 새 repository 생성
2. 이 폴더 안의 파일들을 repository 루트에 업로드
3. Settings > Pages
4. Source: Deploy from branch
5. Branch: main, Folder: /root
6. Save

## Supabase 전 세계 리더보드

1. Supabase 프로젝트 생성
2. SQL Editor 열기
3. `supabase/schema.sql` 내용 실행
4. Project Settings > API
5. Project URL과 publishable/anon key 복사
6. `supabase-config.js`에 입력

```js
window.SUPABASE_URL = "your-project-url";
window.SUPABASE_ANON_KEY = "your-publishable-or-anon-key";
```
