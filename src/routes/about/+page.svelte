<script context="module">
  import { browser, dev } from '$app/environment';

  // we don't need any JS on this page, though we'll load
  // it in dev so that we get hot module replacement...
  export const hydrate = dev;

  // ...but if the client-side router is already loaded
  // (i.e. we came here from elsewhere in the app), use it
  export const router = browser;

  // since there's no dynamic data here, we can prerender
  // it so that it gets served as a static asset in prod
  export const prerender = true;
</script>

<svelte:head>
  <title>關於速成查字</title>
</svelte:head>

<div
  class="content py-12 rounded-md flex flex-col justify-center items-center"
  style="background: #ffffffad"
>
  <h2 class="text-center text-2xl mb-4">咩黎？</h2>

  <div class="px-8 w-full max-w-lg text-left">
    <p>查找中文字嘅速成碼或者倉頡碼。點擊有速成碼嘅字，會顯示字碼拆解圖。</p>
    <br />
    <p>
      呢個係Single page
      app，亦唔需要經backend做字碼轉換，所以真係"超快"。所有資料同運算都只會喺你部手機／電腦上。
    </p>
    <br />
    <p>暫時主要係手機上面用。如果喺電腦用嘅話，要輸入中文字係一個有雞先定蛋先嘅問題。</p>
  </div>
</div>
