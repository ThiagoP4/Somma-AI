import * as XLSX from 'xlsx';
import { useAlertStore } from '../stores/useAlertStore';

export function useExcel(){
    const { showAlert } = useAlertStore();
    const exportToExcel = (data: any[], fileName: string = 'FinanceAI_Registros') => {
        try {
            if (!data || data.length === 0) {
                return;
            }

            const formattedData = data.map(item => ({
                Data: new Date(item.date).toLocaleDateString('pt-BR'),
                Titulo: item.title,
                Categoria: item.Category?.description || 'Sem categoria',
                Valor: item.value
            }))
            
            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');

            XLSX.writeFile(workbook, `${fileName}.xlsx`);
            showAlert('Dados exportados para Excel com sucesso', 'success');

        } catch (error) {
            console.error('Erro ao exportar para Excel:', error);
            showAlert('Erro ao exportar planilha.', 'error');
        }
    };
    const importFromExcel = (): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx, .xls';

            input.onchange = (e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if(!file) {
                    reject(new Error('Nenhum arquivo selecionado.'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const arrayBuffer = event.target?.result;
                        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        if(!firstSheetName) {
                            throw new Error('Nenhuma planilha encontrada.');
                        }
                        const worksheet = workbook.Sheets[firstSheetName];
                        if (!worksheet) {
                            throw new Error('A aba da planilha está vazia ou não pôde ser lida.');
                        }
                        const jsonData = XLSX.utils.sheet_to_json(worksheet);
                        resolve(jsonData);
                    } catch (error) {
                        showAlert('Erro ao importar planilha.', 'error');
                        reject(error);
                    }
                };

                reader.readAsArrayBuffer(file);
            };

            input.click();
        });
    };
    return {
        exportToExcel,
        importFromExcel
    };
}