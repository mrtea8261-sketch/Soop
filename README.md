# 숲 너와 나의 연결거리 v2

이번 버전 변경 사항:

- 한국어 UI
- 연결 경로 애니메이션
- 랜덤 모드
- 선택 모드 추가
- 이오몽 / 2omong 제거
- 새 크롤러에 팔로워 10,000명 이상 조건 추가

## 중요

현재 ZIP 안의 `data/soop_graph_undirected.json`은 기존 데이터에서 이오몽만 제거한 파일입니다.

팔로워 10,000명 이상 조건을 정확히 적용하려면 새 크롤러를 다시 실행해야 합니다.

```txt
crawler/soop_graph_crawler_followers_10000.js
```

## 크롤링 다시 하는 방법

1. SOOP 사이트를 Chrome으로 엽니다.
2. F12를 눌러 DevTools를 엽니다.
3. Console 탭으로 갑니다.
4. `crawler/soop_graph_crawler_followers_10000.js` 파일 내용을 전체 복사해서 Console에 붙여넣습니다.
5. 실행이 끝나면 `soop_graph_undirected.json` 파일이 다운로드됩니다.
6. 그 파일로 아래 파일을 교체합니다.

```txt
data/soop_graph_undirected.json
```

7. GitHub에 다시 업로드/커밋합니다.

## 팔로워 필터 주의

크롤러는 `fan_cnt`, `follower_cnt`, `follow_cnt`, `favorite_cnt`, `subscriber_cnt` 같은 필드를 찾아서 `followers` 값으로 저장합니다.

만약 Console에 `Follower fields empty`가 뜨고 결과가 너무 적게 나오면, SOOP 응답에서 팔로워 수 필드명이 다른 것입니다. 그때는 Console에 찍힌 raw object를 보고 follower 필드명을 추가해야 합니다.

## 선택 모드

웹사이트에서 `선택 모드`를 누르면 시작 스트리머와 목표 스트리머를 직접 고를 수 있습니다.

그 다음 숫자를 누르면 실제 연결 경로가 애니메이션으로 표시됩니다.

## GitHub Pages 업로드

1. ZIP을 풉니다.
2. 안에 있는 파일들을 GitHub repository 루트에 업로드합니다.
3. Settings > Pages
4. Deploy from branch
5. Branch: main, Folder: /root
6. Save

## Supabase

기존처럼 `supabase-config.js`에 Supabase URL과 anon/publishable key를 넣으면 전 세계 리더보드가 작동합니다.
