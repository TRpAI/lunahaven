import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // 如果没有数据，不显示分页
  if (totalItems === 0) return null;

  // 生成页码数组 (支持省略号)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        start = 2;
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs text-xs text-zinc-600 dark:text-zinc-400 ${className}`}
    >
      {/* 左侧：条目计数与单页容量设置 */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          显示第 <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{startItem}</span> -{' '}
          <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{endItem}</span> 条，共{' '}
          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{totalItems}</span> 条
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-zinc-400 hidden sm:inline">每页:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                onPageSizeChange(newSize);
                onPageChange(1); // 切换每页大小时重置为第1页
              }}
              className="px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-mono focus:outline-hidden cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} 条/页
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 右侧：页码翻页控制器 */}
      <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end">
        {/* 首页 */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
          title="第一页"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* 上一页 */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400 cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1 px-2.5"
          title="上一页"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">上一页</span>
        </button>

        {/* 移动端简易页码显示 */}
        <div className="sm:hidden px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
          {currentPage} / {totalPages}
        </div>

        {/* 桌面端详细页码按钮组 */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-zinc-400 select-none">
                  ...
                </span>
              );
            }

            const pageNum = Number(page);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-xs'
                    : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 下一页 */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400 cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1 px-2.5"
          title="下一页"
        >
          <span className="hidden sm:inline text-xs">下一页</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* 尾页 */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent text-zinc-600 dark:text-zinc-400 cursor-pointer disabled:cursor-not-allowed transition-colors"
          title="最后一页"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
