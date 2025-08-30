<script lang="ts">
  import { page } from '$app/stores';
  
  const navItems = [
    { href: '/', label: '字典查詢', icon: '/icons/search.svg' },
    { href: '/typing', label: '打字測試', icon: '/icons/keyboard.svg' }
  ];
  
  $: currentPath = $page.url.pathname;
</script>

<nav class="flex justify-center border-b border-gray-200 bg-white">
  <div class="flex flex-row max-w-md">
    {#each navItems as { href, label, icon }}
      {@const isActive = (href === '/' && currentPath === '/') || (href !== '/' && currentPath.startsWith(href))}
      <a
        {href}
        class={`flex-1 flex flex-col items-center px-4 py-3 text-sm transition-colors duration-200 ${
          isActive 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }`}
        data-sveltekit-prefetch
      >
        <div class="flex items-center space-x-2">
          {#if icon}
            <img 
              src={icon} 
              alt={label}
              class={`h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-60'}`}
              style={isActive ? 'filter: invert(37%) sepia(76%) saturate(2451%) hue-rotate(212deg) brightness(97%) contrast(98%)' : ''}
            />
          {/if}
          <span class="font-medium">{label}</span>
        </div>
      </a>
    {/each}
  </div>
</nav>
