/**
* WkHtmlToPdf table vertically-splitting hack
* Script to automatically split wide HTML tables that doesn't fit the width of the PDF page generated
* by WkHtmlToPdf (or equivalent)
*
* The general idea come from Florin Stancu <niflostancu@gmail.com> and his script wkhtmltopdf.tablesplit.js
* The implementation is quite different because the splitting is done vertically on a excessive
* wide table, while the original script was meant to split horizontally an excessive long table
*
* To use, you must adjust pdfPage object's contents to reflect your PDF's
* page format.
* The tables you want to be automatically splitted when the page ends must
* have the same class name as specified by the variable "verticalTableSplit_ClassName": if not set,
* all tables will be checked for split.
* Also, is possible to have a left vertical header repeating in all table slices: columns of this
* vertical header must have td elements with the same class name as specified by the variable
* "verticalTableSplit_leftHeaderClassName"
*
* Live demo: http://jsfiddle.net/mU2Ne/
* Gist: https://gist.github.com/vstefanoxx/170e90c16f176975f5f6
* GitHub: https://github.com/vstefanoxx/JSUtils/blob/master/TableVerticalSplitHack/TableVerticalSplitHack.js
*
* Dependencies: jQuery.
*
* From original script (and some others forks) I took some variable name and, as I said,
* the original idea
*
* @author Stefano Vargiu <vstefanoxx@gmail.com>
* @license http://www.opensource.org/licenses/mit-license.php MIT License
*/

/**
 * pdfPage, verticalTableSplit_ClassName, verticalTableSplit_leftHeaderClassName
 * You can overwrite these parameters in the page where you are loading this script
 * (after you loaded it) so you can set pdfPage in one place and use,
 * if you need it, both this script and the one that split horizontally the table
 * (wkhtmltopdf.tablesplit.js on GitHub or his forks, see the disclaimer on top)
 */
var pdfPage = {
	width: 11.7,
	height: 8.3,
	margins: {
		top: 2/25.4,
		left: 2/25.4,
		right: 2/25.4,
		bottom: 26/25.4
	}
};
// class name of the tables to automatically split: if not specified, split all tables
//var verticalTableSplit_ClassName = 'splitForPrint';
var verticalTableSplit_ClassName = '';
// class name to specify which columns are part of the vertical left header
var verticalTableSplit_leftHeaderClassName = 'leftHeader';

$(window).load(function () {
	// add_columns
	// Copy columns from the rows $rows to $target_table in the range of indices "from_idx" and "to_idx"
	function add_columns($rows, $target_table, from_idx, to_idx) {
		$rows.each(function() {
			var $tr = $(this);
			$target_table.find('> tbody > tr:eq('+$tr.index()+')')
				.html(
					$('<div>')
						.append(
							$tr.find('> td.' + verticalTableSplit_leftHeaderClassName).clone()
						)
						.append(
							$tr.find('td').slice(from_idx, to_idx+1).clone()
						)
						.html()
				);
		});
	}
	
	// getHeaderRange
	// Calculate header columns range based on data columns indeces "from_idx" and "to_idx", taking into account that headers columns can have colspan
	// attribute (while this function don't manage properly data columns with colspan attributes)
	function getHeaderRange($row, from_idx, to_idx) {
		var $header, $new_header_row, cols_counter, start_idx, end_idx, start_diff_colspan, end_diff_colspan, colspan, diff_col_idx, start_colspan, end_colspan;
		cols_counter = 0;
		start_idx = undefined;
		end_idx = undefined;
		start_diff_colspan = undefined;
		end_diff_colspan = undefined;
		// for every header, find starting and ending header columns indices
		$row.find('> th, > td').each(function() {
			$header = $(this);
			colspan = +($header.attr('colspan') || 1);
			if (start_idx == undefined) {
				diff_col_idx = from_idx - cols_counter;
				if (diff_col_idx >= 0 && diff_col_idx < colspan) {
					start_idx = $header.index();
					start_colspan = colspan;
					if (diff_col_idx > 0) start_diff_colspan = diff_col_idx;
				}
			}
			if (end_idx == undefined) {
				diff_col_idx = to_idx - cols_counter;
				if (diff_col_idx >= 0 && diff_col_idx < colspan) {
					end_idx = $header.index();
					end_colspan = colspan;
					if (diff_col_idx != colspan - 1) end_diff_colspan = colspan - diff_col_idx - 1;
				}
			}
			if (start_idx != undefined && end_idx != undefined)
				return false;
			cols_counter += colspan;
		});
		var is_same_idx = (start_idx == end_idx);
		// return info abount the range of header columns
		var obj = {
			is_same_idx: is_same_idx,
			start_idx: start_idx,
			end_idx: (!is_same_idx ? end_idx : undefined),
			start_colspan: start_colspan,
			end_colspan: end_colspan,
			start_diff_colspan: (start_diff_colspan || 0) + (!is_same_idx ? 0 : (end_diff_colspan || 0)),
			end_diff_colspan: is_same_idx ? undefined : end_diff_colspan
		};
		return obj;
	}
	
	// getHeaderSliceHTML
	// Create and return the headers slices HTML as specified by the ranges "first_range" (relative to the header on top of the vertical left hader)
	// and "second_range" (relative to the header on top of data columns).
	// If header slices are adjacent, it join them 
	function getHeaderSliceHTML($row, first_range, second_range) {
		var ranges = [];
		var last_idx_first_range = (first_range.is_same_idx ? first_range.start_idx : first_range.end_idx);
		// if ranges are adjacent, join them
		if (last_idx_first_range == second_range.start_idx) {
			// modify first range to include second range, and add only that single range
			if (second_range.is_same_idx) {
				if (!first_range.is_same_idx)
					first_range.end_diff_colspan += second_range.start_diff_colspan - first_range.colspan;
			} else {
				first_range.end_idx = second_range.end_idx;
				first_range.end_colspan = second_range.end_colspan;
				if (!first_range.is_same_idx)
					first_range.end_diff_colspan = second_range.end_diff_colspan;
			}
			if (first_range.is_same_idx)
				first_range.start_diff_colspan += second_range.start_diff_colspan - first_range.colspan;
			ranges.push(first_range);
		// ranges are NOT adjacent, add both of them
		} else {
			ranges.push(first_range);
			ranges.push(second_range);
		}
		// create DOM elements from ranges
		var $ret_slices = $('<div>');
		var $cur_slice;
		$.each(ranges, function(idx, range) {
			var $cur_slice = $row.find('> th, > td').slice(range.start_idx, (range.is_same_idx ? range.start_idx : range.end_idx)+1).clone();
			if (range.start_diff_colspan > 0)
				$cur_slice.first().attr('colspan', range.start_colspan - range.start_diff_colspan);
			if (range.end_diff_colspan > 0)
				$cur_slice.last().attr('colspan', range.end_colspan - range.end_diff_colspan);
			$ret_slices.append($cur_slice);
		});
		// return html code
		return $ret_slices.html();
	}
	
	// setHeader
	// set the header and footer of $target_table according to vertical left header and data columns specified (through column indeces)
	function setHeader($header_rows, $footer_rows, $target_table, from_idx, to_idx, leftHeader_last_idx) {
		var $row, $header_slice, leftHeader_header_range, data_header_range, row_type;
		$.each([ $header_rows, $footer_rows ], function(idx, $rows) {
			$rows.each(function() {
				$row = $(this);
				leftHeader_header_range = getHeaderRange($row, 0, leftHeader_last_idx);
				data_header_range = getHeaderRange($row, from_idx, to_idx);
				row_type = (idx == 0 ? 'thead' : 'tfoot');
				$target_table.find('> ' + row_type + ' > tr:eq('+$row.index()+')')
					.html(
						getHeaderSliceHTML($row, leftHeader_header_range, data_header_range)
					);
			});
		});
	}
	
	// get document resolution
	var dpi = $('<div id="dpi"></div>')
		.css({
			height: '1in', width: '1in',
			top: '-100%', left: '-100%',
			position: 'absolute'
		})
		.appendTo('body')
		.width();
		
	// separator div
	var $separator_div = $('<div class="page-breaker" style="height: 10px;"></div>');
	
	// calculate page width
	var pageWidth = Math.ceil((pdfPage.width - pdfPage.margins.left - pdfPage.margins.right) * dpi);
	
	// temporary set body's width and padding to match pdf's size
	var $body = $('body');
	$body.css('width', (pdfPage.width - pdfPage.margins.left - pdfPage.margins.right) + 'in');
	$body.css('padding-left', pdfPage.margins.left + 'in');
	$body.css('padding-right', pdfPage.margins.right + 'in');
	
	//
	// cycle through all tables and split them if necessary
	//
	$('table' + (verticalTableSplit_ClassName == '' ? '' : '.' + verticalTableSplit_ClassName)).each(function () {
		var $collectableDiv = $('<div>');
		var $origin_table = $(this);
		var $rows = $origin_table.find('> tbody > tr');
		var $first_row = $rows.first();
		var $first_row_cols = $first_row.find('> td');
		var num_cols = $first_row_cols.size();
		var $header_rows = $origin_table.find('> thead > tr');
		var $footer_rows = $origin_table.find('> tfoot > tr');
		var x_offset = 0;
		
		// create the template for new table slices
		var $template = $origin_table.clone();
		$template.find('> tbody > tr > td').remove();
		$template.find('> thead > tr > th').remove();
		$template.find('> tfoot > tr > td').remove();
		
		// create first table slice
		var $current_table = $template.clone();
		
		// info abount vertical left header (if present)
		var $leftHeader_last_col = $first_row.find('> td.' + verticalTableSplit_leftHeaderClassName + ':last')
		var leftHeader_last_idx = $leftHeader_last_col.index()
		var leftHeader_right_x = $leftHeader_last_col.offset().left + $leftHeader_last_col.outerWidth();
		var last_idx = leftHeader_last_idx + 1;
			// for every column, check if it fits inside the page width
		$first_row_cols.slice(last_idx).each(function() {
			var $td = $(this);
			// check if column is beyond page right margin
			var td_left = $td.offset().left;
			var is_overflow = (td_left + $td.outerWidth() - x_offset >= pageWidth);
			// if there is no space for the new column, add header and footer to current table slice and create new table slice
			if (is_overflow) {
				var td_idx = $td.index();
				// add header and footer to current table
				setHeader($header_rows, $footer_rows, $current_table, last_idx, td_idx-1, leftHeader_last_idx);
				
				// add to the current table all columns from the one next to previous slice to the one before the current column
				add_columns($rows, $current_table, last_idx, td_idx-1);
				last_idx = td_idx;
			
				// add current table to the array of slices
				$collectableDiv.append($current_table);
				$collectableDiv.append($separator_div.clone());
				x_offset += td_left - leftHeader_right_x;
				
				// create new table slice
				$current_table = $template.clone();
			}
		// END each column
		});
		
		// add header, footer and remaining columns to last table slice
		setHeader($header_rows, $footer_rows, $current_table, last_idx, num_cols-1, leftHeader_last_idx);
		add_columns($rows, $current_table, last_idx, num_cols-1);
		$collectableDiv.append($current_table.clone());
		
		// replace original table with new table slices
		$origin_table.replaceWith($collectableDiv.html());
	// END each table
	});
});