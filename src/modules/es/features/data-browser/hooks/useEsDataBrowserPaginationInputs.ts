import { useEffect } from "react";

interface UseEsDataBrowserPaginationInputsParams {
  page: number;
  pageInput: string;
  setPage: (value: number) => void;
  setPageInput: (value: string) => void;
  setSize: (value: number) => void;
  setSizeInput: (value: string) => void;
  size: number;
  sizeInput: string;
}

export function useEsDataBrowserPaginationInputs({
  page,
  pageInput,
  setPage,
  setPageInput,
  setSize,
  setSizeInput,
  size,
  sizeInput,
}: UseEsDataBrowserPaginationInputsParams) {
  useEffect(() => {
    setSizeInput(String(size));
  }, [setSizeInput, size]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page, setPageInput]);

  const commitSize = () => {
    const parsed = Number.parseInt(sizeInput, 10);
    const next = Number.isNaN(parsed) ? size : Math.max(1, parsed);

    if (next !== size) {
      setSize(next);
      setPage(1);
      return;
    }

    setSizeInput(String(size));
  };

  const commitPage = () => {
    const parsed = Number.parseInt(pageInput.trim(), 10);
    const next = Number.isNaN(parsed) ? page : Math.max(1, parsed);

    if (next !== page) {
      setPage(next);
      return;
    }

    setPageInput(String(page));
  };

  return {
    commitPage,
    commitSize,
  };
}